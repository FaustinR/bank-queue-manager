// Function to format timestamp
function formatTime(timestamp) {
    if (!timestamp) return 'N/A';
    
    const date = new Date(timestamp);
    return date.toLocaleString([], { 
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
}

// Function to get flag HTML for a language
function getFlagForLanguage(language) {
    const flagMap = {
        'English': '<img src="/images/england.png" alt="England flag" class="language-flag">',
        'French': '<img src="/images/france.png" alt="France flag" class="language-flag">',
        'Kinyarwanda': '<img src="/images/rwanda.png" alt="Rwanda flag" class="language-flag">',
        'Swahili': '<img src="/images/swahili.png" alt="Swahili flag" class="language-flag">' 
    };
    
    return flagMap[language] || '';
}

const socket = io();
const counterId = window.location.pathname.split('/').pop();

// Check if we're in an iframe
const isInIframe = window.self !== window.top;

// Add the in-iframe class if we're in an iframe
if (isInIframe) {
    document.body.classList.add('in-iframe');
}

document.getElementById('counterTitle').textContent = `Counter ${counterId} Management`;

// Variable to track if this counter belongs to the current user
let isCurrentUserCounter = false;

// Check if this counter belongs to the current user
async function checkCurrentUserCounter() {
    try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
            const data = await response.json();
            if (data.user && data.user.counter) {
                // Check if the user's counter matches this counter (convert both to strings for comparison)
                isCurrentUserCounter = String(data.user.counter) === String(counterId);

                
                // Update the next button based on whether this is the current user's counter
                const nextBtn = document.getElementById('nextBtn');
                if (isCurrentUserCounter) {
                    // This is the user's counter, enable the button (unless there are no customers)
                    const queueLength = document.querySelectorAll('#queuePreview .queue-table tbody tr').length;
                    nextBtn.disabled = queueLength === 0;
                    nextBtn.title = queueLength === 0 ? 'No customers waiting' : 'Call next customer';
                } else {
                    // Not the user's counter, disable the button
                    nextBtn.disabled = true;
                    nextBtn.title = 'You can only call customers for your assigned counter';
                }
            } else {
                // User doesn't have an assigned counter
                const nextBtn = document.getElementById('nextBtn');
                nextBtn.disabled = true;
                nextBtn.title = 'You need to be assigned to this counter to call customers';
            }
        }
    } catch (error) {
        // Error checking current user counter
    }
}

// Check on page load
checkCurrentUserCounter();

function updateCounter(data) {
    const { queues, counters } = data;
    const counter = counters[counterId];
    const queue = queues[counterId] || [];
    
    if (counter) {
        document.getElementById('counterName').textContent = counter.name;
        document.getElementById('counterStatus').textContent = counter.status;
        
        if (counter.current) {
            document.getElementById('customerName').textContent = counter.current.customerName;
            document.getElementById('customerService').textContent = counter.current.service;
            document.getElementById('customerNumber').textContent = counter.current.number;
            
            // Set language with flag
            const languageElement = document.getElementById('customerLanguage');
            languageElement.innerHTML = getFlagForLanguage(counter.current.language) + counter.current.language;
            document.getElementById('currentCustomer').style.display = 'block';
            document.getElementById('nextBtn').style.display = 'none';
            document.getElementById('completeBtn').style.display = 'inline-block';
        } else {
            document.getElementById('currentCustomer').style.display = 'none';
            document.getElementById('nextBtn').style.display = 'inline-block';
            document.getElementById('completeBtn').style.display = 'none';
            
            // Enable/disable next button based on queue length and if it's the current user's counter
            const nextBtn = document.getElementById('nextBtn');
            if (!isCurrentUserCounter) {
                nextBtn.disabled = true;
                nextBtn.title = 'You can only call customers for your assigned counter';
            } else {
                nextBtn.disabled = queue.length === 0;
                nextBtn.title = queue.length === 0 ? 'No customers waiting' : 'Call next customer';
            }
        }
    }
    
    // Update queue preview for this specific service
    const queueDiv = document.getElementById('queuePreview');
    if (queue.length === 0) {
        queueDiv.innerHTML = '<p>No customers waiting for this service</p>';
    } else {
        // Add table header
        queueDiv.innerHTML = `
            <table class="queue-table">
                <thead>
                    <tr>
                        <th>Number</th>
                        <th>Name</th>
                        <th>Service</th>
                        <th>Language</th>
                        <th>Requested at</th>
                    </tr>
                </thead>
                <tbody>
                    ${queue.slice(0, 5).map(customer => `
                        <tr>
                            <td>#${customer.number}</td>
                            <td>${customer.customerName}</td>
                            <td>${customer.service}</td>
                            <td>
                                ${getFlagForLanguage(customer.language)}
                                ${customer.language}
                            </td>
                            <td>${formatTime(customer.timestamp)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
}

document.getElementById('nextBtn').addEventListener('click', async () => {
    try {
        // Double-check that this is the user's assigned counter
        const response = await fetch('/api/auth/me');
        if (response.ok) {
            const data = await response.json();
            if (data.user && data.user.counter === counterId) {
                // Get current user info to include in the request
                const userName = `${data.user.firstName} ${data.user.lastName}`;
                
                // Call next customer with teller name
                await fetch(`/api/counter/${counterId}/next`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ tellerName: userName })
                });
            } else {
                alert('You can only call customers for your assigned counter');
            }
        }
    } catch (error) {
        // Error calling next customer
    }
});

document.getElementById('completeBtn').addEventListener('click', async () => {
    try {
        await fetch(`/api/counter/${counterId}/complete`, {
            method: 'POST'
        });
    } catch (error) {
        alert('Error completing service');
    }
});

socket.on('queueUpdate', updateCounter);
// Listen for new messages for this counter
socket.on('newMessage', function(data) {
    // Check if this message is for this counter
    if (data && data.counterId === counterId) {

        
        // Show a notification
        if (window.notifications) {
            window.notifications.info('New Message', 'You have a new message in your inbox');
        }
        
        // Update the inbox badge
        if (typeof updateInboxBadge === 'function') {
            updateInboxBadge();
        }
    }
});