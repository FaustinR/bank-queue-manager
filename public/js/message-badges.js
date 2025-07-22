// Check if we're in an iframe or a new tab
const isInIframe = window.self !== window.top;

// If we're in a new tab, don't run this script
if (!isInIframe) {
    console.log('Display screen opened in new tab, not showing message badges');
    // Exit the script early without throwing an error
    document.addEventListener('DOMContentLoaded', function() {
        // Remove any message-related elements
        const messageButtons = document.querySelectorAll('.message-btn');
        messageButtons.forEach(btn => btn.remove());
        
        // Hide message modal
        const messageModal = document.getElementById('messageModal');
        if (messageModal) {
            messageModal.style.display = 'none';
            messageModal.remove(); // Completely remove it from DOM
        }
    });
    // Exit the script
    throw new Error('Display screen opened in new tab, not showing message badges');
}

// Variable to store the current user's counter ID
let currentUserCounterId = null;

// Function to get the current user's counter ID
async function getCurrentUserCounter() {
    try {
        const response = await fetch('/api/messages/current-counter');
        if (!response.ok) return null;
        
        const data = await response.json();
        return data.counterId;
    } catch (error) {
        console.error('Error getting current user counter:', error);
        return null;
    }
}

// Initialize the current user's counter ID and update button text
(async function() {
    currentUserCounterId = await getCurrentUserCounter();
    
    // If we have a counter ID, update the button text
    if (currentUserCounterId) {
        const messageBtn = document.querySelector(`.message-btn[data-counter="${currentUserCounterId}"]`);
        if (messageBtn) {
            // Change button text from "Message" to "Inbox"
            messageBtn.innerHTML = '<i class="fas fa-inbox"></i> Inbox';
            
            messageBtn.removeEventListener('click', window.openMessageModal);
            messageBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                // Navigate to inbox in the main page (same as clicking inbox in sidebar)
                window.top.location.href = '/inbox';
            });
        }
    }
})();

// Function to add badge to message button
function addBadgeToMessageButton(counterId, count) {
    const messageBtn = document.querySelector(`.message-btn[data-counter="${counterId}"]`);
    if (!messageBtn) {
        return;
    }
    
    // Remove any existing badge
    const existingBadge = messageBtn.querySelector('.unread-badge');
    if (existingBadge) {
        existingBadge.remove();
    }
    
    // Add new badge
    const badge = document.createElement('span');
    badge.className = 'unread-badge';
    badge.textContent = count > 99 ? '99+' : count;
    
    // Add inline styles to ensure visibility
    badge.style.position = 'absolute';
    badge.style.top = '-8px';
    badge.style.right = '-8px';
    badge.style.backgroundColor = '#f44336';
    badge.style.color = 'white';
    badge.style.borderRadius = '50%';
    badge.style.padding = '2px 6px';
    badge.style.fontSize = '12px';
    badge.style.fontWeight = 'bold';
    badge.style.zIndex = '1000';
    badge.style.display = 'flex';
    badge.style.alignItems = 'center';
    badge.style.justifyContent = 'center';
    
    messageBtn.appendChild(badge);
    
    // Change icon
    const icon = messageBtn.querySelector('i');
    if (icon && icon.classList.contains('fa-envelope')) {
        icon.classList.remove('fa-envelope');
        icon.classList.add('fa-envelope-open-text');
    }
}

// Check for unread messages every 5 seconds
setInterval(async function() {
    try {
        const response = await fetch('/api/messages/unread-by-counter');
        if (!response.ok) return;
        
        const data = await response.json();
        const unreadByCounter = data.unreadByCounter || {};
        
        // Process unread messages by counter
        
        // First, remove all badges
        const messageButtons = document.querySelectorAll('.message-btn');
        messageButtons.forEach(btn => {
            const existingBadge = btn.querySelector('.unread-badge');
            if (existingBadge) {
                existingBadge.remove();
            }
            
            // Reset the icon
            const icon = btn.querySelector('i');
            if (icon && icon.classList.contains('fa-envelope-open-text')) {
                icon.classList.remove('fa-envelope-open-text');
                icon.classList.add('fa-envelope');
            }
        });
        
        // Add badges ONLY to the current user's counter
        Object.keys(unreadByCounter).forEach(counterId => {
            // Only process the current user's counter
            if (counterId === currentUserCounterId) {
                const count = unreadByCounter[counterId];
                if (count > 0) {
                    const messageBtn = document.querySelector(`.message-btn[data-counter="${counterId}"]`);
                    if (messageBtn) {
                        // Change button text from "Message" to "Inbox"
                        messageBtn.innerHTML = '<i class="fas fa-inbox"></i> Inbox';
                        
                        messageBtn.removeEventListener('click', window.openMessageModal);
                        messageBtn.addEventListener('click', function(e) {
                            e.stopPropagation();
                            // Navigate to inbox in the main page (same as clicking inbox in sidebar)
                            window.top.location.href = '/inbox';
                        });
                        
                        // Add badge only to current user's counter
                        addBadgeToMessageButton(counterId, count);
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error checking unread messages:', error);
    }
}, 5000);

// Listen for new messages
socket.on('newMessage', function(data) {
    // Only process messages for the current user's counter
    if (data && data.counterId && data.counterId === currentUserCounterId) {
        const messageBtn = document.querySelector(`.message-btn[data-counter="${data.counterId}"]`);
        if (messageBtn) {
            // Change button text from "Message" to "Inbox"
            messageBtn.innerHTML = '<i class="fas fa-inbox"></i> Inbox';
            
            messageBtn.removeEventListener('click', window.openMessageModal);
            messageBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                // Navigate to inbox in the main page (same as clicking inbox in sidebar)
                window.top.location.href = '/inbox';
            });
            
            // Add or update badge
            let badge = messageBtn.querySelector('.unread-badge');
            const currentCount = badge ? parseInt(badge.textContent) || 0 : 0;
            addBadgeToMessageButton(data.counterId, currentCount + 1);
        }
    }
});