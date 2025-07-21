document.addEventListener('DOMContentLoaded', function() {
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
            console.log('Not checking unread messages:', error.message);
        });
    
    function updateUnreadBadge() {
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
                    
                    // Add badge if there are unread messages
                    if (unreadCount > 0) {
                        const badge = document.createElement('span');
                        badge.className = 'unread-badge';
                        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                        link.appendChild(badge);
                    }
                });
            })
            .catch(error => {
                console.error('Error checking unread messages:', error);
            });
    }
});