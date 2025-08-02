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
    
    // Refresh counter staff information every 10 seconds
    setInterval(fetchCounterStaff, 10000);
    
    // Setup message modal event listeners
    setupMessageModal();
    
    // Authenticate socket for calls
    try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
            const userData = await response.json();
            socket.emit('authenticate', userData.user._id);
        }
    } catch (error) {
        // Error handling without logging
    }
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
        
        // Make the counter div clickable but prevent clicks on message button from triggering it
        counterDiv.addEventListener('click', (e) => {
            // Don't trigger counter iframe if clicking on message button
            if (!e.target.closest('.message-btn')) {
                showCounterIframe(id, counter.name);
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
                        ${!isCurrentUserCounter ? `<button class="call-btn" data-counter="${counterId}" data-teller="${counterStaff[counterId]}" data-teller-id="${counterStaffIds[counterId]}"><i class="fas fa-phone"></i> Call</button>` : ''}
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
    
    // Show modal
    const modal = document.getElementById('messageModal');
    modal.style.display = 'flex';
}

function closeMessageModal() {
    const modal = document.getElementById('messageModal');
    modal.style.display = 'none';
    
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

const servers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

async function initiateCall(e) {
    e.stopPropagation();
    
    const btn = e.currentTarget;
    const tellerId = btn.getAttribute('data-teller-id');
    const tellerName = btn.getAttribute('data-teller');
    
    if (!tellerId) {
        window.notifications.error('Error', 'Cannot call: Teller information not available');
        return;
    }
    
    try {
        // Get current user info
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
            window.notifications.error('Error', 'Please log in to make calls');
            return;
        }
        
        const userData = await response.json();
        const callerName = `${userData.user.firstName} ${userData.user.lastName}`;
        
        // Get user media
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Create peer connection
        peerConnection = new RTCPeerConnection(servers);
        
        // Add local stream
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Handle remote stream
        peerConnection.ontrack = (event) => {
            remoteStream = event.streams[0];
            const remoteAudio = document.getElementById('remoteAudio');
            if (remoteAudio) {
                remoteAudio.srcObject = remoteStream;
            }
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
        
        // Create offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // Send call request
        socket.emit('call-user', {
            recipientId: tellerId,
            callerName: callerName,
            offer: offer
        });
        
        currentCall = { recipientId: tellerId, recipientName: tellerName };
        showCallModal('outgoing', tellerName);
        
    } catch (error) {
        window.notifications.error('Error', 'Failed to start call: ' + error.message);
        cleanupCall();
    }
}

function showCallModal(type, name) {
    // Create call modal if it doesn't exist
    let callModal = document.getElementById('callModal');
    if (!callModal) {
        callModal = document.createElement('div');
        callModal.id = 'callModal';
        callModal.className = 'modal';
        callModal.innerHTML = `
            <div class="modal-content call-modal">
                <div class="call-info">
                    <div class="call-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="call-name" id="callName"></div>
                    <div class="call-status" id="callStatus"></div>
                </div>
                <div class="call-controls">
                    <button id="endCallBtn" class="end-call-btn">
                        <i class="fas fa-phone-slash"></i>
                    </button>
                </div>
                <audio id="remoteAudio" autoplay></audio>
            </div>
        `;
        document.body.appendChild(callModal);
        
        // Add event listener for end call
        document.getElementById('endCallBtn').addEventListener('click', endCall);
    }
    
    document.getElementById('callName').textContent = name;
    document.getElementById('callStatus').textContent = type === 'outgoing' ? 'Calling...' : 'Incoming call';
    callModal.style.display = 'flex';
}

function endCall() {
    if (currentCall) {
        socket.emit('end-call', { targetId: currentCall.recipientId });
    }
    cleanupCall();
    hideCallModal();
}

function cleanupCall() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    currentCall = null;
}

function hideCallModal() {
    const callModal = document.getElementById('callModal');
    if (callModal) {
        callModal.style.display = 'none';
    }
}

// Socket event listeners for calls
socket.on('call-failed', (data) => {
    window.notifications.error('Call Failed', data.reason);
    cleanupCall();
    hideCallModal();
});

socket.on('call-answered', async (data) => {
    try {
        await peerConnection.setRemoteDescription(data.answer);
        document.getElementById('callStatus').textContent = 'Connected';
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
        console.error('Error adding ICE candidate:', error);
    }
});

socket.on('call-ended', () => {
    cleanupCall();
    hideCallModal();
});