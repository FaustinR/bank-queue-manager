document.addEventListener('DOMContentLoaded', function() {
    // Ensure this script runs after sidebar is loaded
    setTimeout(initUnreadBadge, 100);
});

function initUnreadBadge() {
    // Check if user is authenticated
    fetch('/api/auth/me')
        .then(response => {
            if (response.ok) {
                return response.json();
            }
            throw new Error('Not authenticated');
        })
        .then(() => {
            // User is authenticated, check for unread messages
            updateUnreadBadge();
            
            // Update unread count every minute
            setInterval(updateUnreadBadge, 60000);
        })
        .catch(error => {
            // Not authenticated or error, do nothing
        });
    
}

function updateUnreadBadge() {
        fetch('/api/messages/unread')
            .then(response => response.json())
            .then(data => {
                const unreadCount = data.unreadCount;
                
                // Find all inbox links in the page
                const inboxLinks = document.querySelectorAll('a[href="/inbox"]');
                
                inboxLinks.forEach(link => {
                    // Remove any existing badge and notification icon
                    const existingBadge = link.querySelector('.unread-badge');
                    if (existingBadge) {
                        existingBadge.remove();
                    }
                    
                    // Get the icon element
                    const iconElement = link.querySelector('.icon') || link;
                    
                    // Remove any existing notification dot
                    const existingDot = link.querySelector('.notification-dot');
                    if (existingDot) {
                        existingDot.remove();
                    }
                    
                    // Add badge if there are unread messages
                    if (unreadCount > 0) {
                        // Add the badge with count
                        const badge = document.createElement('span');
                        badge.className = 'unread-badge';
                        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                        link.appendChild(badge);
                        
                        // Add a pulsing dot to make it more noticeable
                        const notificationDot = document.createElement('span');
                        notificationDot.className = 'notification-dot';
                        iconElement.style.position = 'relative';
                        iconElement.appendChild(notificationDot);
                        
                        // Change the icon to indicate new messages
                        if (iconElement.textContent === '✉️') {
                            iconElement.textContent = '📬'; // Mailbox with mail icon
                        }
                        
                        // Add blinking effect to the icon
                        iconElement.classList.add('blink-icon');
                        
                        // Make the text red for new messages
                        const textSpan = link.querySelector('span');
                        if (textSpan) {
                            textSpan.style.color = '#f44336';
                            textSpan.style.fontWeight = 'bold';
                        }
                    } else {
                        // Reset icon to default if no unread messages
                        if (iconElement.textContent === '📬') {
                            iconElement.textContent = '✉️';
                        }
                        
                        // Remove blinking effect
                        iconElement.classList.remove('blink-icon');
                        
                        // Reset text color
                        const textSpan = link.querySelector('span');
                        if (textSpan) {
                            textSpan.style.color = '';
                            textSpan.style.fontWeight = '';
                        }
                    }
                });
            })
            .catch(error => {
                // Error checking unread messages
            });
    }
});