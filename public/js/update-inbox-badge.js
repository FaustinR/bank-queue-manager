// This script can be included on any page to update the inbox badge
window.addEventListener('load', function() {
    // Call immediately and then every 30 seconds
    setTimeout(function() {
        updateInboxBadge();
        setInterval(updateInboxBadge, 30000);
    }, 500);
});

// Also try on DOMContentLoaded for faster loading
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(updateInboxBadge, 200);
});

// Make the function globally available
window.updateInboxBadge = function() {
    // Try both selectors to find the inbox link
    const inboxItems = document.querySelectorAll('.sidebar-nav li a[href="/inbox"], .nav-links a[href="/inbox"]');
    
    if (inboxItems.length === 0) {
        // Try again in a moment if no inbox links found
        setTimeout(updateInboxBadge, 500);
        return;
    }
    
    fetch('/api/messages/unread')
        .then(response => response.json())
        .then(data => {
            const unreadCount = data.unreadCount;
            
            // Update all inbox links found
            inboxItems.forEach(inboxItem => {
                // Ensure the link has position relative
                inboxItem.style.position = 'relative';
                
                // Remove any existing badge
                const existingBadge = inboxItem.querySelector('.unread-badge');
                if (existingBadge) {
                    existingBadge.remove();
                }
                
                // Get the icon element
                const iconElement = inboxItem.querySelector('.icon');
                
                // Remove any existing notification dot
                if (iconElement) {
                    const existingDot = iconElement.querySelector('.notification-dot');
                    if (existingDot) {
                        existingDot.remove();
                    }
                }
                
                // Add badge if there are unread messages
                if (unreadCount > 0) {
                    // Add the badge with count
                    const badge = document.createElement('span');
                    badge.className = 'unread-badge';
                    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                    
                    // Check if this is in the sidebar or elsewhere
                    const isSidebar = inboxItem.closest('.sidebar-nav') !== null;
                    if (isSidebar) {
                        badge.style.right = '15px';
                    } else {
                        badge.style.right = '10px';
                    }
                    
                    inboxItem.appendChild(badge);
                    
                    // Add a pulsing dot to make it more noticeable
                    if (iconElement) {
                        const notificationDot = document.createElement('span');
                        notificationDot.className = 'notification-dot';
                        iconElement.style.position = 'relative';
                        iconElement.appendChild(notificationDot);
                        
                        // Change the icon to indicate new messages
                        if (iconElement.textContent === '✉️') {
                            iconElement.textContent = '📬'; // Mailbox with mail icon
                        }
                    }
                    
                    // Make the text red for new messages
                    const textSpan = inboxItem.querySelector('span');
                    if (textSpan && textSpan.textContent.trim() === 'Inbox') {
                        textSpan.style.color = '#f44336';
                        textSpan.style.fontWeight = 'bold';
                    }
                } else {
                    // Reset icon if no unread messages
                    if (iconElement && iconElement.textContent === '📬') {
                        iconElement.textContent = '✉️';
                    }
                    
                    // Reset text color
                    const textSpan = inboxItem.querySelector('span');
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