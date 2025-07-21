// This script can be included on any page to update the inbox badge
document.addEventListener('DOMContentLoaded', function() {
    // Call immediately and then every 30 seconds
    updateInboxBadge();
    setInterval(updateInboxBadge, 30000);
});

function updateInboxBadge() {
    fetch('/api/messages/unread')
        .then(response => response.json())
        .then(data => {
            const unreadCount = data.unreadCount;
            
            // Find all inbox links in the page
            const inboxLinks = document.querySelectorAll('a[href="/inbox"]');
            
            inboxLinks.forEach(link => {
                // Remove any existing badge
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
                }
            });
        })
        .catch(error => {
            console.error('Error checking unread messages:', error);
        });
}