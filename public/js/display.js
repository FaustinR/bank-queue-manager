// Notification sound function
function playNotificationSound() {
    try {
        // Create audio context for better browser compatibility
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
        // Fallback: try to use HTML5 audio if available
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
            audio.volume = 0.3;
            audio.play().catch(() => {});
        } catch (e) {
            // Fallback audio failed
        }
    }
}

// Text-to-speech function with language support
let isSpeaking = false;
function speak(text, language) {
    if ('speechSynthesis' in window && !isSpeaking) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        isSpeaking = true;
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Get available voices
        const voices = window.speechSynthesis.getVoices();
        
        // Set language and voice based on customer preference
        switch(language) {
            case 'French':
                utterance.lang = 'fr-FR';
                const frenchVoice = voices.find(voice => voice.lang.includes('fr'));
                if (frenchVoice) utterance.voice = frenchVoice;
                break;
            case 'English':
                utterance.lang = 'en-US';
                const englishVoice = voices.find(voice => voice.lang === 'en-US');
                if (englishVoice) utterance.voice = englishVoice;
                break;
            case 'Kinyarwanda':
            case 'Swahili':
                utterance.lang = 'en-US';
                const otherEnglishVoice = voices.find(voice => voice.lang === 'en-US');
                if (otherEnglishVoice) utterance.voice = otherEnglishVoice;
                break;
            default:
                utterance.lang = 'en-US';
        }
        
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        // Reset flag when speech ends
        utterance.onend = () => {
            isSpeaking = false;
        };
        
        utterance.onerror = () => {
            isSpeaking = false;
        };
        
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
// Function to show counter details
function showCounterDetails(counterId, counterName) {
    // Do nothing - we'll use the original showCounterIframe function
    showCounterIframe(counterId, counterName);
}

// Function to show counter iframe
function showCounterIframe(counterId, counterName) {
    // Only show counter iframe if we're in an iframe (embedded)
    const isInIframe = window.self !== window.top;
    if (!isInIframe) {
        return; // Do nothing if not in iframe
    }
    
    const counterContainer = document.getElementById('counterContainer');
    const counterFrame = document.getElementById('counterFrame');
    const counterTitle = document.getElementById('counterTitle');
    
    // Set the iframe source with embedded=true parameter
    counterFrame.src = `/counter/${counterId}?embedded=true`;
    
    // Set the counter title
    counterTitle.textContent = `Counter ${counterId}: ${counterName}`;
    
    // Show the container
    counterContainer.style.display = 'block';
    
    // Scroll to the container
    counterContainer.scrollIntoView({ behavior: 'smooth' });
}

const socket = io();

// Global variables to store counter information
let counterStaff = {};
let counterStaffIds = {}; // Store staff IDs for messaging

// Initialize these variables to prevent errors
if (typeof counterStaff === 'undefined') counterStaff = {};
if (typeof counterStaffIds === 'undefined') counterStaffIds = {};

// Fetch counter staff information
async function fetchCounterStaff() {
    try {
        const response = await fetch('/api/counters/staff');
        
        if (!response.ok) {
            return;
        }
        
        const data = await response.json();
        counterStaff = data.counterStaff || {};
        counterStaffIds = data.counterStaffIds || {};
        
        // Force update the display with the latest staff information
        const countersDiv = document.getElementById('counters');
        if (countersDiv && countersDiv.children.length > 0) {
            // Find all counter divs and update staff information
            Array.from(countersDiv.children).forEach(counterDiv => {
                const counterId = counterDiv.querySelector('h3').textContent.replace('Counter ', '').trim();
                const staffElement = counterDiv.querySelector('.counter-staff');
                const staffContainer = counterDiv.querySelector('.counter-staff-container');
                
                if (counterStaff[counterId]) {
                    // If staff element exists, update it, otherwise create it
                    if (staffElement) {
                        staffElement.innerHTML = `<strong>Teller:</strong> ${counterStaff[counterId]}`;
                        
                        // Check if we're in an iframe or a new tab
                        const isInIframe = window.self !== window.top;
                        
                        // Add or update message button if not already there and only if in iframe
                        if (isInIframe) {
                            let messageBtn = staffContainer.querySelector('.message-btn');
                            if (!messageBtn) {
                                messageBtn = document.createElement('button');
                                messageBtn.className = 'message-btn';
                                messageBtn.style.position = 'relative';
                                messageBtn.innerHTML = '<i class="fas fa-envelope"></i> Message';
                                messageBtn.setAttribute('data-counter', counterId);
                                messageBtn.setAttribute('data-teller', counterStaff[counterId]);
                                messageBtn.setAttribute('data-teller-id', counterStaffIds[counterId] || '');
                                messageBtn.addEventListener('click', openMessageModal);
                                staffContainer.appendChild(messageBtn);
                            } else {
                                // Update data attributes
                                messageBtn.setAttribute('data-teller', counterStaff[counterId]);
                                messageBtn.setAttribute('data-teller-id', counterStaffIds[counterId] || '');
                            }
                        }
                    } else {
                        const staffP = document.createElement('p');
                        staffP.className = 'counter-staff';
                        staffP.innerHTML = `<strong>Teller:</strong> ${counterStaff[counterId]}`;
                        
                        // Insert after the counter heading
                        const counterHeading = counterDiv.querySelector('h3');
                        if (counterHeading) {
                            counterHeading.insertAdjacentElement('afterend', staffP);
                        }
                        
                        // Check if we're in an iframe or a new tab
                        const isInIframe = window.self !== window.top;
                        
                        // Add message button only if in iframe
                        if (staffContainer && isInIframe) {
                            const messageBtn = document.createElement('button');
                            messageBtn.className = 'message-btn';
                            messageBtn.style.position = 'relative';
                            messageBtn.innerHTML = '<i class="fas fa-envelope"></i> Message';
                            messageBtn.setAttribute('data-counter', counterId);
                            messageBtn.setAttribute('data-teller', counterStaff[counterId]);
                            messageBtn.setAttribute('data-teller-id', counterStaffIds[counterId] || '');
                            messageBtn.addEventListener('click', openMessageModal);
                            staffContainer.appendChild(messageBtn);
                        }
                    }
                } else {
                    // No staff assigned to this counter
                    if (staffElement) {
                        staffElement.innerHTML = `<strong>Teller:</strong> <span class="not-assigned">Not assigned</span>`;
                        
                        // Remove message button if it exists
                        const messageBtn = staffContainer.querySelector('.message-btn');
                        if (messageBtn) {
                            messageBtn.remove();
                        }
                    }
                }
            });
        }
    } catch (error) {
        // Error handling without logging
    }
}

// Function to get the current user's counter ID
async function getCurrentUserCounter() {
    try {
        const response = await fetch('/api/messages/current-counter');
        if (!response.ok) return null;
        
        const data = await response.json();
        return data.counterId;
    } catch (error) {
        return null;
    }
}

// Check if page is in an iframe and setup close button
document.addEventListener('DOMContentLoaded', async function() {
    
    // Get the current user's counter ID and store it in localStorage
    const currentUserCounterId = await getCurrentUserCounter();
    if (currentUserCounterId) {
        localStorage.setItem('currentUserCounterId', currentUserCounterId);
    }
    
    // Check if we're in an iframe or a new tab
    const isInIframe = window.self !== window.top;
    
    if (isInIframe) {
        // We're in an iframe
        document.body.classList.add('embedded-display');
        
        // Hide any sidebar toggle buttons
        const sidebarToggles = document.querySelectorAll('.sidebar-toggle');
        sidebarToggles.forEach(toggle => {
            toggle.style.display = 'none';
            toggle.style.visibility = 'hidden';
        });
    } else {
        // We're in a new tab - hide and remove the message modal
        const messageModal = document.getElementById('messageModal');
        if (messageModal) {
            messageModal.style.display = 'none';
            messageModal.remove(); // Completely remove it from DOM
        }
        
        // Remove any message buttons that might have been added
        const messageButtons = document.querySelectorAll('.message-btn');
        messageButtons.forEach(btn => btn.remove());
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
            if (data.counterStaffIds) {
                counterStaffIds = data.counterStaffIds;
            }
            updateDisplay(data);
        }
    } catch (error) {
        // Error handling without logging
    }
    
    // Refresh counter staff information every 30 seconds (reduced frequency)
    setInterval(fetchCounterStaff, 30000);
    
    // Setup message modal event listeners
    setupMessageModal();
    
    // Completely disable incoming call notifications in display screen
    socket.off('incoming-call');
    socket.removeAllListeners('incoming-call');
    
    // Prevent any incoming call handling in display screen
    socket.on('incoming-call', function() {
        // Do nothing - notifications handled by parent page only
        return;
    });
    
    // Authenticate socket for calls immediately with retry mechanism
    let authRetries = 0;
    const maxAuthRetries = 3;
    
    const authenticateSocket = async () => {
        try {
            const response = await fetch('/api/auth/me');
            if (response.ok) {
                const userData = await response.json();
                socket.emit('authenticate', userData.user._id);
                
                // Store user ID globally for call handling
                window.currentUserId = userData.user._id;
                
                return true;
            } else {
                return false;
            }
        } catch (error) {
            return false;
        }
    };
    
    const tryAuthenticate = async () => {
        const success = await authenticateSocket();
        if (!success && authRetries < maxAuthRetries) {
            authRetries++;
            setTimeout(tryAuthenticate, 1000 * authRetries);
        }
    };
    
    await tryAuthenticate();
    
    // Wait for authentication confirmation with timeout
    socket.on('authenticated', (data) => {
        window.socketAuthenticated = true;
    });
    
    // Listen for messages from parent page
    window.addEventListener('message', function(event) {
        if (event.data.type === 'sendMessage') {
            const data = event.data.data;
            
            // Send message using existing function logic
            fetch('/api/messages/display-to-teller', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tellerId: data.tellerId,
                    senderEmail: data.customerEmail,
                    senderName: data.customerName,
                    subject: data.subject,
                    content: data.content
                })
            })
            .then(response => response.json())
            .then(result => {
                if (result.messageId) {
                    window.parent.postMessage({
                        type: 'messageSuccess',
                        message: `Message sent to ${data.tellerName}`
                    }, '*');
                } else {
                    window.parent.postMessage({
                        type: 'messageError',
                        message: 'Error sending message'
                    }, '*');
                }
            })
            .catch(error => {
                window.parent.postMessage({
                    type: 'messageError',
                    message: 'Error sending message'
                }, '*');
            });
        }
    });
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
        // Ensure serving status takes priority over has-waiting
        const statusClass = counter.status === 'serving' ? 'serving' : counter.status;
        const waitingClass = (queueLength > 0 && counter.status !== 'serving') ? 'has-waiting' : '';
        counterDiv.className = `counter ${statusClass} ${waitingClass}`.trim();
        
        // Make the counter div clickable but prevent clicks on message button from triggering it
        counterDiv.addEventListener('click', async (e) => {
            // Don't trigger counter iframe if clicking on message button or other buttons
            if (!e.target.closest('.message-btn, .call-btn, .voice-note-btn')) {
                // Check user role and counter assignment before allowing counter access
                try {
                    const response = await fetch('/api/auth/me');
                    if (response.ok) {
                        const userData = await response.json();
                        const userRole = userData.user.role;
                        const userCounter = userData.user.counter;
                        
                        // Allow admins and supervisors to access any counter
                        // Allow employees to access only their assigned counter
                        if (userRole === 'admin' || userRole === 'supervisor' || 
                            (userRole === 'employee' && userCounter === id.toString())) {
                            showCounterIframe(id, counter.name);
                        }
                    }
                } catch (error) {
                    // Silently ignore errors
                }
            }
        });
        
        // Make sure the ID is a string for comparison with counterStaff
        const counterId = id.toString();
        
        // Check if this is the current user's counter
        let isCurrentUserCounter = false;
        let currentUserCounterId = null;
        
        // Try to get the current user's counter ID from localStorage
        if (localStorage.getItem('currentUserCounterId')) {
            currentUserCounterId = localStorage.getItem('currentUserCounterId');
            isCurrentUserCounter = (counterId === currentUserCounterId);
        }
        
        // Check if we're in an iframe or a new tab
        const isInIframe = window.self !== window.top;
        
        // Create the counter HTML
        counterDiv.innerHTML = `
            <h3>Counter ${id}</h3>
            <div class="counter-staff-container ${counterStaff[counterId] ? 'has-staff' : 'no-staff'}">
                ${counterStaff[counterId] ? 
                    `<p class="counter-staff"><strong>Teller:</strong> ${counterStaff[counterId]}</p>` : 
                    '<p class="counter-staff"><strong>Teller:</strong> <span class="not-assigned">Not assigned</span></p>'}
                ${(counterStaff[counterId] && counterStaffIds[counterId] && isInIframe) ? 
                    `<div class="counter-actions">
                        <button class="message-btn" style="position: relative;" data-counter="${counterId}" data-teller="${counterStaff[counterId]}" data-teller-id="${counterStaffIds[counterId]}"><i class="${isCurrentUserCounter ? 'fas fa-inbox' : 'fas fa-envelope'}"></i> ${isCurrentUserCounter ? 'Inbox' : 'Message'}</button>
                        ${!isCurrentUserCounter && window.innerWidth > 768 && !('ontouchstart' in window) ? `<button class="call-btn" data-counter="${counterId}" data-teller="${counterStaff[counterId]}" data-teller-id="${counterStaffIds[counterId]}"><i class="fas fa-phone"></i> Call</button>` : ''}
                        ${!isCurrentUserCounter ? `<button class="voice-note-btn" data-counter="${counterId}" data-teller="${counterStaff[counterId]}" data-teller-id="${counterStaffIds[counterId]}"><i class="fas fa-microphone"></i> Voice Note</button>` : ''}
                    </div>` : 
                    ''}
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
        
        // Add event listeners to buttons only if in iframe
        if (isInIframe) {
            const messageBtn = counterDiv.querySelector('.message-btn');
            if (messageBtn) {
                messageBtn.addEventListener('click', openMessageModal);
            }
            
            const callBtn = counterDiv.querySelector('.call-btn');
            if (callBtn) {
                callBtn.addEventListener('click', initiateCall);
            }
            
            const voiceNoteBtn = counterDiv.querySelector('.voice-note-btn');
            if (voiceNoteBtn) {
                voiceNoteBtn.addEventListener('click', startVoiceNote);
            }
        }
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
                        <th>Teller</th>
                    </tr>
                </thead>
                <tbody>
                    ${allCustomers.map(customer => {
                        const counterId = customer.counterId.toString();
                        const tellerName = counterStaff[counterId] || 'Not assigned';
                        return `
                        <tr>
                            <td>#${customer.number}</td>
                            <td>${customer.customerName}</td>
                            <td>${customer.service}</td>
                            <td>Counter ${customer.counterId}</td>
                            <td>${tellerName !== 'Not assigned' ? tellerName : '<span class="not-assigned">Not assigned</span>'}</td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        `;
    }
    
    // No need to check for unread messages in the display screen
}

socket.on('queueUpdate', async (data) => {
    try {
        // Update counter staff information from the data
        if (data.counterStaff) {
            counterStaff = data.counterStaff;
        }
        if (data.counterStaffIds) {
            counterStaffIds = data.counterStaffIds;
        } else {
            // Fallback to fetching counter staff information
            await fetchCounterStaff();
        }
        
        // Update the display with the latest data
        updateDisplay(data);
        
        // Update staff information without updating the display again
        setTimeout(async () => {
            await fetchCounterStaff();
            // Don't call updateDisplay again to avoid duplicating content
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
    
    // Play notification sound only once
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
        
        if (customer.language === 'French') {
            announcement = `Client ${customer.customerName}, numéro ${customer.number}, veuillez vous rendre au guichet ${counter} pour ${translatedService}.`;
        } else {
            // Use English for all other languages (English, Kinyarwanda, Swahili, and default)
            announcement = `Customer ${customer.customerName}, number ${customer.number}, please proceed to counter ${counter} for ${translatedService}.`;
        }
        
        // Speak the announcement in the customer's preferred language
        speak(announcement, customer.language);
    }, 1500);
    
    // Hide after 10 seconds
    setTimeout(() => {
        nowServing.style.display = 'none';
    }, 10000);
});

// Message Modal Functions
async function openMessageModal(e) {
    e.stopPropagation(); // Prevent counter click event
    
    const btn = e.currentTarget;
    const counterId = btn.getAttribute('data-counter');
    const tellerName = btn.getAttribute('data-teller');
    const tellerId = btn.getAttribute('data-teller-id');
    
    // Check if we have a valid teller ID
    if (!tellerId) {
        window.notifications.error('Error', 'Cannot send message: Teller information is not available');
        return;
    }
    
    // Check if this is the current user's counter
    try {
        const response = await fetch('/api/messages/current-counter');
        if (response.ok) {
            const data = await response.json();
            if (data.counterId === counterId) {
                // This is the current user's counter, navigate to inbox in the main page
                window.top.location.href = '/inbox';
                return;
            }
        }
    } catch (error) {
        // Error handling without logging
    }
    
    // Set form values
    document.getElementById('tellerId').value = tellerId;
    document.getElementById('tellerName').value = tellerName;
    document.getElementById('counterNumber').value = counterId;
    document.getElementById('subject').value = `Message from Display Screen - Counter ${counterId}`;
    
    // Update modal title with teller name
    const modalTitle = document.querySelector('#messageModal .modal-header h3');
    if (modalTitle) {
        modalTitle.textContent = `Send Message to Teller ${tellerName}`;
    }
    
    // Get current user info and populate customer fields
    try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
            const userData = await response.json();
            document.getElementById('customerEmail').value = userData.user.email || '';
            document.getElementById('customerName').value = `${userData.user.firstName || ''} ${userData.user.lastName || ''}`.trim();
        }
    } catch (error) {
        document.getElementById('customerEmail').value = '';
        document.getElementById('customerName').value = '';
    }
    
    // Get and populate teller information
    try {
        const response = await fetch(`/api/users/${tellerId}/basic`);
        if (response.ok) {
            const tellerData = await response.json();
            document.getElementById('tellerEmail').value = tellerData.email || '';
            document.getElementById('tellerDisplayName').value = `${tellerData.firstName || ''} ${tellerData.lastName || ''}`.trim();
        } else {
            document.getElementById('tellerEmail').value = '';
            document.getElementById('tellerDisplayName').value = tellerName || '';
        }
    } catch (error) {
        document.getElementById('tellerEmail').value = '';
        document.getElementById('tellerDisplayName').value = tellerName || '';
    }
    
    // Check if we're in an iframe and send message to parent
    const isInIframe = window.self !== window.top;
    if (isInIframe) {
        // Send message data to parent page to open modal there
        window.parent.postMessage({
            type: 'openMessageModal',
            data: {
                tellerId,
                tellerName,
                counterId,
                customerEmail: document.getElementById('customerEmail').value,
                customerName: document.getElementById('customerName').value,
                subject: document.getElementById('subject').value
            }
        }, '*');
    } else {
        // Show modal in current page
        const modal = document.getElementById('messageModal');
        modal.classList.add('show');
    }
}

function closeMessageModal() {
    const modal = document.getElementById('messageModal');
    modal.classList.remove('show');
    
    // Reset the form completely since we're filling with teller info each time
    const form = document.getElementById('messageForm');
    form.reset();
}

function sendMessage(e) {
    e.preventDefault();
    
    const tellerId = document.getElementById('tellerId').value;
    const tellerName = document.getElementById('tellerName').value;
    const customerEmail = document.getElementById('customerEmail').value;
    const customerName = document.getElementById('customerName').value;
    const subject = document.getElementById('subject').value;
    const content = document.getElementById('messageContent').value;
    
    if (!tellerId || !customerEmail || !customerName || !subject || !content) {
        window.notifications.error('Error', 'Please fill in all required fields');
        return;
    }
    
    // No need to save email and name since we're using teller info
    
    // Prepare message data
    const messageData = {
        tellerId: tellerId,
        senderEmail: customerEmail,
        senderName: customerName,
        subject,
        content
    };
    
    // Send message using the display-to-teller endpoint
    fetch('/api/messages/display-to-teller', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(messageData)
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                try {
                    const errorData = JSON.parse(text);
                    throw new Error(errorData.message || 'Failed to send message');
                } catch (e) {
                    throw new Error('Failed to send message: ' + text);
                }
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.messageId) {
            // Close modal
            closeMessageModal();
            
            // Show success message
            window.notifications.success('Success', `Message sent to ${tellerName}`);
        } else {
            window.notifications.error('Error', 'Error sending message: ' + data.message);
        }
    })
    .catch(error => {
        window.notifications.error('Error', error.message || 'Error sending message. Please try again.');
    });
}

// Setup message modal event listeners
function setupMessageModal() {
    const closeModalBtn = document.querySelector('.close-modal');
    const cancelMessageBtn = document.getElementById('cancelMessage');
    const messageForm = document.getElementById('messageForm');
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeMessageModal);
    }
    
    if (cancelMessageBtn) {
        cancelMessageBtn.addEventListener('click', closeMessageModal);
    }
    
    if (messageForm) {
        messageForm.addEventListener('submit', sendMessage);
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('messageModal');
        if (event.target === modal) {
            closeMessageModal();
        }
    });
}
// Listen for the newMessage socket event and allow badges in the display screen
socket.on('newMessage', function(data) {
    // Let the message-badges.js script handle the badges
});

// Call functionality
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let currentCall = null;
let callEnding = false; // Flag to track intentional call ending

const servers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

async function initiateCall(e) {
    // Disable call functionality on mobile devices
    if (window.innerWidth <= 768 || 'ontouchstart' in window) {
        window.notifications.info('Info', 'Voice calls are not available on mobile devices');
        return;
    }
    
    e.stopPropagation();
    
    const btn = e.currentTarget;
    const tellerId = btn.getAttribute('data-teller-id');
    const tellerName = btn.getAttribute('data-teller');
    const counterId = btn.getAttribute('data-counter');
    
    if (!tellerId) {
        window.notifications.error('Error', 'Cannot call: Teller information not available');
        return;
    }
    
    // Initialize audio context on user interaction
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
    } catch (e) {
        // Audio context init failed
    }
    
    try {
        // Check if socket is connected and authenticated
        if (!socket.connected) {
            window.notifications.error('Error', 'Connection lost. Please refresh the page.');
            return;
        }
        
        // Get current user info
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
            window.notifications.error('Error', 'Please log in to make calls');
            return;
        }
        
        const userData = await response.json();
        const callerName = `${userData.user.firstName} ${userData.user.lastName}`;
        
        // Ensure socket is authenticated before making call
        if (!window.socketAuthenticated) {
            socket.emit('authenticate', userData.user._id);
            
            // Wait for authentication with timeout
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Authentication timeout'));
                }, 5000);
                
                const onAuth = () => {
                    clearTimeout(timeout);
                    socket.off('authenticated', onAuth);
                    resolve();
                };
                
                socket.on('authenticated', onAuth);
            });
        }
        
        // Simple audio constraints for reliability
        const audioConstraints = {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
        };
        
        // Get microphone with better device handling
        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    deviceId: 'default' // Use default audio device
                },
                video: false
            });
        } catch (error) {
            if (error.name === 'NotAllowedError') {
                alert('Please allow microphone access for voice calls');
            } else if (error.name === 'NotReadableError') {
                alert('Microphone is busy. Please close other applications using the microphone and try again.');
            } else {
                alert('Failed to access microphone: ' + error.message);
            }
            throw error;
        }
        
        // Create or get local audio element with mobile compatibility
        let localAudio = document.getElementById('localAudio');
        if (!localAudio) {
            localAudio = document.createElement('audio');
            localAudio.id = 'localAudio';
            localAudio.autoplay = true;
            localAudio.controls = false;
            localAudio.muted = true; // Prevent echo
            localAudio.playsInline = true; // Critical for iOS
            localAudio.style.display = 'none';
            document.body.appendChild(localAudio);
        }
        localAudio.srcObject = localStream;
        
        // Create peer connection with optimized STUN servers
        peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 4,
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        });
        
        // Add local stream
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Handle remote stream
        peerConnection.ontrack = (event) => {
            remoteStream = event.streams[0];
            
            if (!remoteStream || remoteStream.getAudioTracks().length === 0) {
                return;
            }
            
            // Remove existing audio element
            let remoteAudio = document.getElementById('remoteAudio');
            if (remoteAudio) {
                remoteAudio.remove();
            }
            
            // Create hidden audio element with autoplay
            remoteAudio = document.createElement('audio');
            remoteAudio.autoplay = true;
            remoteAudio.controls = false;
            remoteAudio.playsInline = true;
            remoteAudio.volume = 1.0;
            remoteAudio.muted = false;
            remoteAudio.setAttribute('playsinline', 'true');
            remoteAudio.setAttribute('webkit-playsinline', 'true');
            remoteAudio.style.display = 'none';
            document.body.appendChild(remoteAudio);
            
            // Set stream and make globally accessible
            remoteAudio.srcObject = remoteStream;
            window.remoteAudio = remoteAudio;
            
            // Force play with better Bluetooth speaker support
            setTimeout(async () => {
                try {
                    // Set audio output to default device (Bluetooth speaker if connected)
                    if (remoteAudio.setSinkId && typeof remoteAudio.setSinkId === 'function') {
                        await remoteAudio.setSinkId('default');
                    }
                    await remoteAudio.play();
                } catch (e) {
                    // Show enable audio button if autoplay fails
                    const enableBtn = document.createElement('button');
                    enableBtn.textContent = '🔊 Click to Enable Audio';
                    enableBtn.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 100000; background: #007bff; color: white; border: none; padding: 15px 25px; border-radius: 8px; font-size: 16px; cursor: pointer;';
                    enableBtn.onclick = async () => {
                        try {
                            if (remoteAudio.setSinkId) {
                                await remoteAudio.setSinkId('default');
                            }
                            await remoteAudio.play();
                            enableBtn.remove();
                        } catch (err) {
                            alert('Failed to play audio: ' + err.message);
                        }
                    };
                    document.body.appendChild(enableBtn);
                }
            }, 100);
        };
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', {
                    targetId: tellerId,
                    candidate: event.candidate
                });
            }
        };
        
        // Create offer with better codec preferences
        const offer = await peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: false
        });
        await peerConnection.setLocalDescription(offer);
        
        // Send call request with caller info
        socket.emit('call-user', {
            recipientId: tellerId,
            callerName: callerName,
            callerId: userData.user._id,
            callerEmail: userData.user.email,
            offer: offer
        });
        
        // Show outgoing call notification on parent page (top level)
        const counterServices = {
            '1': 'Account Opening',
            '2': 'Loan Application', 
            '3': 'Money Transfer',
            '4': 'Card Services',
            '5': 'General Inquiry'
        };
        
        const callNotificationData = {
            type: 'outgoing',
            name: tellerName,
            counter: counterId || 'Unknown',
            service: counterServices[counterId] || 'Banking Service',
            recipientId: tellerId
        };
        
        // Show notification on parent page if in iframe
        const isInIframe = window.self !== window.top;
        if (isInIframe) {
            window.parent.postMessage({
                type: 'showCallNotification',
                callData: callNotificationData
            }, '*');
        } else if (typeof window.showOutgoingCallNotification === 'function') {
            window.showOutgoingCallNotification(tellerName, counterId || 'Unknown', counterServices[counterId] || 'Banking Service', tellerId);
        }
        
        currentCall = { recipientId: tellerId, recipientName: tellerName };
        
        // Make localStream globally accessible for mute functionality
        window.localStream = localStream;
        
    } catch (error) {
        window.notifications.error('Error', 'Failed to start call: ' + error.message);
        cleanupCall();
    }
}

// Call modal removed - using notification system only

function endCall() {
    // Set flag to indicate intentional call ending
    callEnding = true;
    
    // Store target ID before cleanup
    const targetId = currentCall ? currentCall.recipientId : null;
    
    // Immediately clean up local resources first
    cleanupCall();
    
    // Hide call notification on parent page
    const isInIframe = window.self !== window.top;
    if (isInIframe) {
        window.parent.postMessage({
            type: 'hideCallNotification'
        }, '*');
    } else if (typeof window.hideCallNotification === 'function') {
        window.hideCallNotification();
    }
    
    // Send end call signal after cleanup
    if (targetId) {
        socket.emit('end-call', { targetId: targetId });
    }
}

// Call modal functions removed - using notification system only

function cleanupCall() {
    // Clear call data first to prevent further processing
    currentCall = null;
    window.incomingCallData = null;
    window.localStream = null;
    
    // Stop all media tracks FIRST to remove browser tab speaker icon
    if (localStream) {
        localStream.getTracks().forEach(track => {
            track.stop();
        });
        localStream = null;
    }
    
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => {
            track.stop();
        });
        remoteStream = null;
    }
    
    // Clear and remove audio elements completely
    const remoteAudio = document.getElementById('remoteAudio');
    const localAudio = document.getElementById('localAudio');
    if (remoteAudio) {
        remoteAudio.pause();
        remoteAudio.srcObject = null;
        remoteAudio.src = '';
        remoteAudio.load(); // Force reload to clear media
    }
    if (localAudio) {
        localAudio.pause();
        localAudio.srcObject = null;
        localAudio.src = '';
        localAudio.load(); // Force reload to clear media
    }
    
    // Resume background audio that was paused during call
    document.querySelectorAll('audio, video').forEach(media => {
        if (media.getAttribute('data-paused-by-call') === 'true') {
            media.removeAttribute('data-paused-by-call');
            // Don't auto-resume, let user decide
        }
    });
    
    // Close peer connection after media cleanup
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    // Remove call indicator
    const indicator = document.getElementById('callIndicator');
    if (indicator) indicator.remove();
    
    // Reset call ending flag
    callEnding = false;
}

// hideCallModal removed - using notification system only

// Socket event listeners for calls
socket.on('call-failed', (data) => {
    window.notifications.error('Call Failed', data.reason);
    cleanupCall();
    
    // Hide call notification on parent page
    const isInIframe = window.self !== window.top;
    if (isInIframe) {
        window.parent.postMessage({
            type: 'hideCallNotification'
        }, '*');
    } else if (typeof window.hideCallNotification === 'function') {
        window.hideCallNotification();
    }
});

socket.on('call-declined', () => {
    cleanupCall();
    
    // Hide call notification on parent page
    const isInIframe = window.self !== window.top;
    if (isInIframe) {
        window.parent.postMessage({
            type: 'hideCallNotification'
        }, '*');
    } else if (typeof window.hideCallNotification === 'function') {
        window.hideCallNotification();
    }
});

socket.on('call-answered', async (data) => {
    try {
        await peerConnection.setRemoteDescription(data.answer);
    } catch (error) {
        window.notifications.error('Error', 'Failed to connect call');
        endCall();
    }
});

socket.on('ice-candidate', async (candidate) => {
    try {
        if (peerConnection) {
            await peerConnection.addIceCandidate(candidate);
        }
    } catch (error) {
        // ICE candidate error
    }
});

socket.on('call-ended', () => {
    cleanupCall();
    
    // Hide call notification on parent page
    const isInIframe = window.self !== window.top;
    if (isInIframe) {
        window.parent.postMessage({
            type: 'hideCallNotification'
        }, '*');
    } else if (typeof window.hideCallNotification === 'function') {
        window.hideCallNotification();
    }
});

// Handle socket reconnection
socket.on('connect', () => {
    // Re-authenticate if we have user ID
    if (window.currentUserId) {
        socket.emit('authenticate', window.currentUserId);
    }
});

socket.on('disconnect', () => {
    window.socketAuthenticated = false;
    // Clean up any ongoing calls
    if (currentCall || window.incomingCallData) {
        cleanupCall();
        window.notifications.info('Connection Lost', 'Call ended due to connection loss');
    }
});

// Handle call-related disconnections
socket.on('call-ended-disconnect', (data) => {
    if (currentCall && currentCall.recipientId === data.userId) {
        cleanupCall();
        
        // Hide call notification on parent page
        const isInIframe = window.self !== window.top;
        if (isInIframe) {
            window.parent.postMessage({
                type: 'hideCallNotification'
            }, '*');
        } else if (typeof window.hideCallNotification === 'function') {
            window.hideCallNotification();
        }
    }
});

// Voice note functionality
let isRecording = false;
let mediaRecorder = null;
let recordedChunks = [];

async function startVoiceNote(e) {
    e.stopPropagation();
    
    const btn = e.currentTarget;
    const tellerId = btn.getAttribute('data-teller-id');
    const tellerName = btn.getAttribute('data-teller');
    const counterId = btn.getAttribute('data-counter');
    
    if (!tellerId) {
        window.notifications.error('Error', 'Cannot send voice note: Teller information not available');
        return;
    }
    
    if (isRecording) {
        stopRecording(btn);
        return;
    }
    
    try {
        // Get available audio input devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        
        // Try to find built-in microphone (usually contains 'built-in', 'internal', or 'default')
        let micDeviceId = 'default';
        const builtInMic = audioInputs.find(device => 
            device.label.toLowerCase().includes('built-in') ||
            device.label.toLowerCase().includes('internal') ||
            device.label.toLowerCase().includes('array') ||
            device.deviceId === 'default'
        );
        
        if (builtInMic) {
            micDeviceId = builtInMic.deviceId;
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                deviceId: micDeviceId,
                sampleRate: 48000,
                channelCount: 2,
                volume: 1.0,
                latency: 0,
                googEchoCancellation: false,
                googAutoGainControl: false,
                googNoiseSuppression: false,
                googHighpassFilter: false,
                googTypingNoiseDetection: false
            }
        });
        
        recordedChunks = [];
        
        // Try different MIME types for better quality
        let mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/webm';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/mp4';
        }
        
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: mimeType,
            audioBitsPerSecond: 128000
        });
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
            await sendVoiceNote(audioBlob, tellerId, tellerName, counterId);
            
            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start();
        isRecording = true;
        
        // Update button appearance
        btn.innerHTML = '<i class="fas fa-stop"></i> Stop Recording';
        btn.style.background = '#dc3545';
        
        window.notifications.info('Recording', 'Voice note recording started');
        
    } catch (error) {
        window.notifications.error('Error', 'Failed to access microphone: ' + error.message);
    }
}

function stopRecording(btn) {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        
        // Reset button appearance
        btn.innerHTML = '<i class="fas fa-microphone"></i> Voice Note';
        btn.style.background = '#17a2b8';
        
        window.notifications.info('Processing', 'Sending voice note...');
    }
}

async function sendVoiceNote(audioBlob, tellerId, tellerName, counterId) {
    try {
        // Convert blob to base64
        const reader = new FileReader();
        reader.onloadend = async function() {
            const base64data = reader.result;
            
            const response = await fetch('/api/messages/voice-note', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tellerId,
                    tellerName,
                    counterId,
                    audioData: base64data
                })
            });
            
            if (response.ok) {
                window.notifications.success('Success', `Voice note sent to ${tellerName}`);
            } else {
                const error = await response.text();
                window.notifications.error('Error', 'Failed to send voice note: ' + error);
            }
        };
        reader.readAsDataURL(audioBlob);
    } catch (error) {
        window.notifications.error('Error', 'Failed to send voice note: ' + error.message);
    }
}

// Remove all incoming call handling from display.js - handled by notification system only

// Remove incoming call socket listener to prevent duplicate notifications
socket.off('incoming-call');

