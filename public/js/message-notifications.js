document.addEventListener('DOMContentLoaded', function() {
    // Only run if we're not on the inbox page
    if (window.location.pathname !== '/inbox') {
        let currentUserId = null;
        
        // Check if user is authenticated
        fetch('/api/auth/me')
            .then(response => {
                if (response.ok) {
                    return response.json();
                }
                throw new Error('Not authenticated');
            })
            .then(data => {
                currentUserId = data.user._id;
                
                // Connect to Socket.IO
                const socket = io();
                
                // Listen for new message notifications
                socket.on('newMessage', function(data) {
                    // Check if this message is for the current user
                    if (data.recipientId === currentUserId) {
                        // Play notification sound
                        playNotificationSound();
                        
                        // Show toast notification
                        showToast(`New message from ${data.senderName}`, data.subject);
                        
                        // Update unread badge
                        updateUnreadBadge();
                    }
                });
            })
            .catch(error => {
                // Not authenticated or error, do nothing
            });
    }
    
    // Play notification sound
    function playNotificationSound() {
        try {
            const audio = new Audio('/sounds/message-notification.mp3');
            audio.volume = 0.5;
            audio.play();
        } catch (error) {
            // Could not play notification sound
        }
    }
    
    // Show toast notification
    function showToast(title, message) {
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            document.body.appendChild(toastContainer);
        }
        
        // Create toast
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `
            <div class="toast-header">
                <strong>${title}</strong>
                <button type="button" class="toast-close">&times;</button>
            </div>
            <div class="toast-body">${message}</div>
        `;
        
        // Add click handler to go to inbox
        toast.addEventListener('click', function(e) {
            if (!e.target.classList.contains('toast-close')) {
                window.location.href = '/inbox';
            }
        });
        
        // Add close button handler
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            toast.classList.add('toast-hiding');
            setTimeout(() => {
                toast.remove();
            }, 300);
        });
        
        // Add to container
        toastContainer.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.classList.add('toast-hiding');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 5000);
    }
    
    // Update unread badge
    function updateUnreadBadge() {
        // If update-inbox-badge.js is loaded, use that function
        if (typeof window.updateInboxBadge === 'function') {
            window.updateInboxBadge();
            return;
        }
        
        // Fallback implementation
        fetch('/api/messages/unread')
            .then(response => response.json())
            .then(data => {
                const unreadCount = data.unreadCount;
                
                // Find all inbox links in the page
                const inboxLinks = document.querySelectorAll('a[href="/inbox"]');
                
                inboxLinks.forEach(link => {
                    // Ensure the link has position relative
                    link.style.position = 'relative';
                    
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
                // Error checking unread messages
            });
    }
});