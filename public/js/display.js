// Text-to-speech function with language support
function speak(text, language) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Get available voices
        const voices = window.speechSynthesis.getVoices();
        
        // Set language and voice based on customer preference
        switch(language) {
            case 'French':
                utterance.lang = 'fr-FR';
                // Try to find a French voice
                const frenchVoice = voices.find(voice => voice.lang.includes('fr'));
                if (frenchVoice) utterance.voice = frenchVoice;
                break;
            case 'English':
                utterance.lang = 'en-US'; // Use US English instead of British
                // Try to find an American English voice
                const englishVoice = voices.find(voice => voice.lang === 'en-US');
                if (englishVoice) utterance.voice = englishVoice;
                break;
            case 'Kinyarwanda':
            case 'Swahili':
                // Use English for Kinyarwanda and Swahili
                utterance.lang = 'en-US';
                // Use the same variable name pattern as other cases
                const otherEnglishVoice = voices.find(voice => voice.lang === 'en-US');
                if (otherEnglishVoice) utterance.voice = otherEnglishVoice;
                break;
            default:
                utterance.lang = 'en-US';
        }
        
        utterance.rate = 0.9; // Slightly slower rate for clarity
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        // Voice selection complete
        
        window.speechSynthesis.speak(utterance);
    }
}

// Initialize voices
if ('speechSynthesis' in window) {
    // Chrome needs this to initialize voices
    window.speechSynthesis.onvoiceschanged = function() {
        window.speechSynthesis.getVoices();
    };
    // Initialize voices right away
    window.speechSynthesis.getVoices();
}

// Function to show counter iframe
function showCounterIframe(counterId, counterName) {
    const counterContainer = document.getElementById('counterContainer');
    const counterFrame = document.getElementById('counterFrame');
    const counterTitle = document.getElementById('counterTitle');
    
    // Set the iframe source
    counterFrame.src = `/counter/${counterId}`;
    
    // Set the counter title
    counterTitle.textContent = `Counter ${counterId}: ${counterName}`;
    
    // Show the container
    counterContainer.style.display = 'block';
    
    // Scroll to the container
    counterContainer.scrollIntoView({ behavior: 'smooth' });
}

const socket = io();

// Global variable to store counter staff information
let counterStaff = {};

// Fetch counter staff information
async function fetchCounterStaff() {
    try {
        const response = await fetch('/api/counters/staff');
        
        if (!response.ok) {
            return;
        }
        
        const data = await response.json();
        counterStaff = data.counterStaff || {};
        
        // Force update the display with the latest staff information
        const countersDiv = document.getElementById('counters');
        if (countersDiv && countersDiv.children.length > 0) {
            // Find all counter divs and update staff information
            Array.from(countersDiv.children).forEach(counterDiv => {
                const counterId = counterDiv.querySelector('h3').textContent.replace('Counter ', '').trim();
                const staffElement = counterDiv.querySelector('.counter-staff');
                
                if (counterStaff[counterId]) {
                    // If staff element exists, update it, otherwise create it
                    if (staffElement) {
                        staffElement.innerHTML = `<strong>Teller:</strong> ${counterStaff[counterId]}`;
                    } else {
                        const staffP = document.createElement('p');
                        staffP.className = 'counter-staff';
                        staffP.innerHTML = `<strong>Teller:</strong> ${counterStaff[counterId]}`;
                        
                        // Insert after the counter heading
                        const counterHeading = counterDiv.querySelector('h3');
                        if (counterHeading) {
                            counterHeading.insertAdjacentElement('afterend', staffP);
                        }
                    }
                } else {
                    // No staff assigned to this counter
                    if (staffElement) {
                        staffElement.innerHTML = `<strong>Teller:</strong> <span class="not-assigned">Not assigned</span>`;
                    }
                }
            });
        }
    } catch (error) {
        // Error handling without logging
    }
}

// Check if page is in an iframe and setup close button
document.addEventListener('DOMContentLoaded', async function() {
    if (window.self !== window.top) {
        // We're in an iframe
        document.body.classList.add('embedded-display');
    }
    
    // Setup close button for counter iframe
    const closeBtn = document.getElementById('closeCounter');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            const counterContainer = document.getElementById('counterContainer');
            const counterFrame = document.getElementById('counterFrame');
            
            // Hide the container
            counterContainer.style.display = 'none';
            
            // Clear the iframe src to stop any ongoing processes
            setTimeout(() => {
                counterFrame.src = '';
            }, 300);
        });
    }
    
    // Fetch initial data including counter staff information
    try {
        const response = await fetch('/api/queue');
        if (response.ok) {
            const data = await response.json();
            if (data.counterStaff) {
                counterStaff = data.counterStaff;
            }
            updateDisplay(data);
        }
    } catch (error) {
        // Error handling without logging
    }
    
    // Refresh counter staff information every 10 seconds
    setInterval(fetchCounterStaff, 10000);
});

function updateDisplay(data) {
    const { queues, counters } = data;
    
    // Update counters
    const countersDiv = document.getElementById('counters');
    countersDiv.innerHTML = '';
    
    Object.entries(counters).forEach(([id, counter]) => {
        const queueLength = queues[id] ? queues[id].length : 0;
        const counterDiv = document.createElement('div');
        // Add 'has-waiting' class if there are customers waiting
        counterDiv.className = `counter ${counter.status} ${queueLength > 0 ? 'has-waiting' : ''}`;
        counterDiv.onclick = () => showCounterIframe(id, counter.name);
        // Make sure the ID is a string for comparison with counterStaff
        const counterId = id.toString();
        
        counterDiv.innerHTML = `
            <h3>Counter ${id}</h3>
            <div class="counter-staff-container ${counterStaff[counterId] ? 'has-staff' : 'no-staff'}">
                ${counterStaff[counterId] ? 
                    `<p class="counter-staff"><strong>Teller:</strong> ${counterStaff[counterId]}</p>` : 
                    '<p class="counter-staff"><strong>Teller:</strong> <span class="not-assigned">Not assigned</span></p>'}
            </div>
            <div class="counter-info">
                <p class="counter-service"><strong>Service:</strong> ${counter.name}</p>
                <p class="counter-status"><strong>Status:</strong> ${counter.status.charAt(0).toUpperCase() + counter.status.slice(1)}</p>
                <p class="waiting-count ${queueLength > 0 ? 'has-waiting' : ''}"><strong>Customers waiting:</strong> ${queueLength}</p>
            </div>
            <div class="current-customer">
                ${counter.current ? 
                    `${counter.current.customerName}<br>
                     is being served` : 
                    'Available'
                }
            </div>
        `;
        countersDiv.appendChild(counterDiv);
    });
    
    // Update queue - show all queues
    const queueDiv = document.getElementById('queueList');
    let allCustomers = [];
    
    Object.entries(queues).forEach(([counterId, queue]) => {
        queue.forEach(customer => {
            allCustomers.push({...customer, counterId});
        });
    });
    
    // Sort customers by timestamp (descending) - latest first
    allCustomers.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (allCustomers.length === 0) {
        queueDiv.innerHTML = '<p>No customers waiting</p>';
    } else {
        queueDiv.innerHTML = `
            <table class="queue-table">
                <thead>
                    <tr>
                        <th>Number</th>
                        <th>Name</th>
                        <th>Service</th>
                        <th>Counter</th>
                    </tr>
                </thead>
                <tbody>
                    ${allCustomers.map(customer => `
                        <tr>
                            <td>#${customer.number}</td>
                            <td>${customer.customerName}</td>
                            <td>${customer.service}</td>
                            <td>Counter ${customer.counterId}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
}

socket.on('queueUpdate', async (data) => {
    try {
        // Update counter staff information from the data
        if (data.counterStaff) {
            counterStaff = data.counterStaff;
        } else {
            // Fallback to fetching counter staff information
            await fetchCounterStaff();
        }
        updateDisplay(data);
        
        // Always fetch counter staff information after a queue update
        // This ensures we have the latest staff information
        setTimeout(async () => {
            await fetchCounterStaff();
            updateDisplay(data);
        }, 1000);
    } catch (error) {
        // Still update the display even if there's an error
        updateDisplay(data);
    }
});

// Listen for staff logout events
socket.on('staffLogout', async (data) => {
    try {
        const { counterId } = data;
        
        // Remove staff from the counter in our local data immediately
        if (counterId && counterStaff[counterId]) {
            delete counterStaff[counterId];
            
            // Update the display immediately with the local change
            const countersDiv = document.getElementById('counters');
            if (countersDiv) {
                const counterDivs = Array.from(countersDiv.querySelectorAll('.counter'));
                const counterDiv = counterDivs.find(div => {
                    const id = div.querySelector('h3').textContent.replace('Counter ', '').trim();
                    return id === counterId.toString();
                });
                
                if (counterDiv) {
                    const staffContainer = counterDiv.querySelector('.counter-staff-container');
                    if (staffContainer) {
                        staffContainer.className = 'counter-staff-container no-staff';
                    }
                    
                    const staffElement = counterDiv.querySelector('.counter-staff');
                    if (staffElement) {
                        staffElement.innerHTML = '<strong>Teller:</strong> <span class="not-assigned">Not assigned</span>';
                    }
                }
            }
        }
        
        // Then get fresh data from server
        const response = await fetch('/api/queue');
        if (response.ok) {
            const freshData = await response.json();
            updateDisplay(freshData);
        } else {
            // If fetch fails, at least refresh counter staff information
            await fetchCounterStaff();
        }
    } catch (error) {
        // Error handling without logging
        // Still try to refresh counter staff information
        await fetchCounterStaff();
    }
});

socket.on('customerCalled', (data) => {
    const { customer, counter, counterName } = data;
    const nowServing = document.getElementById('nowServing');
    const servingDetails = document.getElementById('servingDetails');
    
    servingDetails.innerHTML = `
        ${customer.customerName} (#${customer.number})<br>
        Please proceed to Counter ${counter}
    `;
    nowServing.style.display = 'block';
    
    // Play notification sound first
    playNotificationSound();
    
    // Wait a moment for the sound to finish before speaking
    setTimeout(() => {
        // Translate service name based on language
        let translatedService;
        
        // Service name translations
        const serviceTranslations = {
            'Account Opening': {
                'English': 'Account Opening',
                'French': 'Ouverture de Compte',
                'Kinyarwanda': 'Gufungura Konti',
                'Swahili': 'Kufungua Akaunti'
            },
            'Loan Application': {
                'English': 'Loan Application',
                'French': 'Demande de Prêt',
                'Kinyarwanda': 'Gusaba Inguzanyo',
                'Swahili': 'Maombi ya Mkopo'
            },
            'Money Transfer': {
                'English': 'Money Transfer',
                'French': 'Transfert d\'Argent',
                'Kinyarwanda': 'Kohereza Amafaranga',
                'Swahili': 'Kutuma Pesa'
            },
            'Card Services': {
                'English': 'Card Services',
                'French': 'Services de Carte',
                'Kinyarwanda': 'Serivisi z\'Ikarita',
                'Swahili': 'Huduma za Kadi'
            },
            'General Inquiry': {
                'English': 'General Inquiry',
                'French': 'Renseignements Généraux',
                'Kinyarwanda': 'Ibibazo Rusange',
                'Swahili': 'Maswali ya Jumla'
            }
        };
        
        // Get the base service name (without "Other: " prefix)
        let baseService = counterName;
        if (baseService.startsWith('Other: ')) {
            baseService = 'General Inquiry';
        }
        
        // Get translated service name or use original if not found
        if (serviceTranslations[baseService] && serviceTranslations[baseService][customer.language]) {
            translatedService = serviceTranslations[baseService][customer.language];
        } else {
            translatedService = baseService;
        }
        
        // For Kinyarwanda and Swahili, we'll use English service names
        if (customer.language === 'Kinyarwanda' || customer.language === 'Swahili') {
            translatedService = baseService;
        }
        
        // Get language-specific announcement
        let announcement;
        
        switch(customer.language) {
            case 'French':
                announcement = `Client ${customer.customerName}, veuillez vous rendre au guichet ${counter} pour ${translatedService}.`;
                break;
            case 'English':
                announcement = `Customer ${customer.customerName}, please proceed to counter ${counter} for ${translatedService}.`;
                break;
            case 'Kinyarwanda':
            case 'Swahili':
                // Use English for Kinyarwanda and Swahili customers
                announcement = `Customer ${customer.customerName}, please proceed to counter ${counter} for ${baseService}.`;
                break;
            default:
                announcement = `Customer ${customer.customerName}, please proceed to counter ${counter} for ${translatedService}.`;
        }
        
        // Speak the announcement in the customer's preferred language
        speak(announcement, customer.language);
    }, 1500);
    
    // Hide after 10 seconds
    setTimeout(() => {
        nowServing.style.display = 'none';
    }, 10000);
});