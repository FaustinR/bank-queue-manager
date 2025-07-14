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

document.getElementById('counterTitle').textContent = `Counter ${counterId} Management`;

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
            
            // Enable/disable next button based on queue length
            document.getElementById('nextBtn').disabled = queue.length === 0;
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
        await fetch(`/api/counter/${counterId}/next`, {
            method: 'POST'
        });
    } catch (error) {
        console.error('Error calling next customer:', error);
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