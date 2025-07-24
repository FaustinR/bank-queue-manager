// Function to disconnect a user
function disconnectUser(userId) {
    if (!userId) return;
    
    fetch('/api/users/mark-disconnected', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Reload connected users
            loadConnectedUsers();
        }
    })
    .catch(error => {
        console.error('Error disconnecting user:', error);
    });
}

// Function to load connected users
function loadConnectedUsers() {
    fetch('/api/users/connected')
        .then(response => response.json())
        .then(data => {
            const connectedUsersList = document.getElementById('connectedUsersList');
            if (connectedUsersList) {
                if (data.connectedUsers && data.connectedUsers.length > 0) {
                    connectedUsersList.innerHTML = '';
                    
                    // Store the current user's ID from the response
                    const currentUserId = data.currentUserId;
                    
                    // Sort users to put current user first
                    const sortedUsers = [...data.connectedUsers].sort((a, b) => {
                        const aIsCurrent = String(a._id) === String(currentUserId);
                        const bIsCurrent = String(b._id) === String(currentUserId);
                        
                        if (aIsCurrent && !bIsCurrent) return -1;
                        if (!aIsCurrent && bIsCurrent) return 1;
                        return 0;
                    });
                    
                    sortedUsers.forEach(user => {
                        const userCard = document.createElement('div');
                        
                        // Check if this is the current user - convert both to strings for comparison
                        const isCurrentUser = String(user._id) === String(currentUserId);
                        
                        // Add special class for current user
                        userCard.className = isCurrentUser ? 'connected-user-card current-user' : 'connected-user-card';
                        
                        let counterBadge = '';
                        if (user.counter) {
                            counterBadge = `<span class="counter-badge">Counter ${user.counter}</span>`;
                        }
                        
                        // Add "You" flag for current user
                        const youFlag = isCurrentUser ? '<span class="you-flag">You</span>' : '';
                        
                        // Add disconnect button for admin users (except for themselves)
                        const disconnectBtn = (!isCurrentUser && window.location.pathname === '/users') ? 
                            `<button class="disconnect-btn" data-user-id="${user._id}">Disconnect</button>` : '';
                        
                        userCard.innerHTML = `
                            <h3>${user.firstName} ${user.lastName} ${youFlag}</h3>
                            <p>${user.email}</p>
                            <span class="user-role role-${user.role}">${user.role}</span>
                            ${counterBadge}
                            ${disconnectBtn}
                        `;
                        
                        connectedUsersList.appendChild(userCard);
                        
                        // Add event listener for disconnect button
                        const disconnectButton = userCard.querySelector('.disconnect-btn');
                        if (disconnectButton) {
                            disconnectButton.addEventListener('click', function(e) {
                                e.stopPropagation();
                                const userId = this.getAttribute('data-user-id');
                                disconnectUser(userId);
                            });
                        }
                    });
                } else {
                    // If no connected users but we have a current user ID, show a message
                    if (data.currentUserId) {
                        connectedUsersList.innerHTML = '<p>Refreshing connected users...</p>';
                        // Try to mark the current user as connected
                        fetch('/api/users/mark-connected', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({})
                        }).then(() => {
                            // Reload after a short delay
                            setTimeout(loadConnectedUsers, 500);
                        });
                    } else {
                        connectedUsersList.innerHTML = '<p>No users currently connected</p>';
                    }
                }
            }
        })
        .catch(error => {
            const connectedUsersList = document.getElementById('connectedUsersList');
            if (connectedUsersList) {
                connectedUsersList.innerHTML = '<p>Error loading connected users</p>';
            }
        });
}

document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the admin page or users page
    if (window.location.pathname === '/admin' || window.location.pathname === '/users') {
        // Set up socket.io to listen for user connection updates
        if (typeof io !== 'undefined') {
            const socket = io();
            socket.on('userConnectionUpdate', function(data) {
                // Reload connected users when there's an update
                loadConnectedUsers();
            });
        }
        
        // Connected Users section is now displayed at the top by default
        // No need for a button to show it
        
        // Load connected users initially
        loadConnectedUsers();
        
        // Set up a timer to refresh connected users every 30 seconds
        setInterval(loadConnectedUsers, 30000);
        
        // Set up accordion functionality for users page
        if (window.location.pathname === '/users') {
            const accordionHeaders = document.querySelectorAll('.accordion-header');
            accordionHeaders.forEach(header => {
                header.addEventListener('click', function() {
                    const section = this.parentElement;
                    
                    // Toggle active class
                    section.classList.toggle('active');
                    
                    // If this section is now active and it's the connected users section, refresh the list
                    if (section.classList.contains('active') && section.id === 'connectedUsersSection') {
                        loadConnectedUsers();
                    }
                });
            });
            
            // Make sure the Connected Users section is active by default
            const connectedUsersSection = document.getElementById('connectedUsersSection');
            if (connectedUsersSection && !connectedUsersSection.classList.contains('active')) {
                connectedUsersSection.classList.add('active');
            }
        }
    }
});