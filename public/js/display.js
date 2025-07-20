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
        
        // Log available voices for debugging
        console.log('Available voices:', voices);
        console.log('Selected language:', utterance.lang);
        console.log('Selected voice:', utterance.voice ? utterance.voice.name : 'Default');
        
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
        console.log('Fetching counter staff information...');
        const response = await fetch('/api/counters/staff');
        
        if (!response.ok) {
            console.error('Failed to fetch counter staff:', response.status, response.statusText);
            return;
        }
        
        const data = await response.json();
        counterStaff = data.counterStaff || {};
        console.log('Counter staff loaded:', counterStaff);
        console.log('Counter staff keys:', Object.keys(counterStaff));
        
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
                        staffElement.textContent = `${counterStaff[counterId]}`;
                    } else {
                        const staffP = document.createElement('p');
                        staffP.className = 'counter-staff';
                        staffP.textContent = `${counterStaff[counterId]}`;
                        
                        // Insert after the counter name paragraph
                        const counterNameP = counterDiv.querySelector('p');
                        if (counterNameP) {
                            counterNameP.insertAdjacentElement('afterend', staffP);
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error fetching counter staff:', error);
    }
}

// Check if page is in an iframe and setup close button
document.addEventListener('DOMContentLoaded', function() {
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
    
    // Fetch counter staff information immediately
    fetchCounterStaff();
    
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
        
        // Debug log for counter staff
        console.log(`Counter ${id} staff check:`, { 
            counterId, 
            hasStaff: !!counterStaff[counterId],
            staffName: counterStaff[counterId] || 'None'
        });
        
        counterDiv.innerHTML = `
            <h3>Counter ${id}</h3>
            <p>${counter.name}</p>
            ${counterStaff[counterId] ? `<p class="counter-staff">${counterStaff[counterId]}</p>` : ''}
            <div class="current-customer">
                ${counter.current ? 
                    `${counter.current.customerName}<br>
                     is being served` : 
                    'Available'
                }
            </div>
            <p class="waiting-count ${queueLength > 0 ? 'has-waiting' : ''}">Waiting: ${queueLength}</p>
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
        // Refresh counter staff information
        await fetchCounterStaff();
        updateDisplay(data);
    } catch (error) {
        console.error('Error handling queue update:', error);
        // Still update the display even if fetching staff fails
        updateDisplay(data);
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