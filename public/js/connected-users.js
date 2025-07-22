// Function to load connected users
function loadConnectedUsers() {
    fetch('/api/users/connected')
        .then(response => response.json())
        .then(data => {
            const connectedUsersList = document.getElementById('connectedUsersList');
            if (connectedUsersList) {
                if (data.connectedUsers && data.connectedUsers.length > 0) {
                    connectedUsersList.innerHTML = '';
                    
                    data.connectedUsers.forEach(user => {
                        const userCard = document.createElement('div');
                        userCard.className = 'connected-user-card';
                        
                        let counterBadge = '';
                        if (user.counter) {
                            counterBadge = `<span class="counter-badge">Counter ${user.counter}</span>`;
                        }
                        
                        userCard.innerHTML = `
                            <h3>${user.firstName} ${user.lastName}</h3>
                            <p>${user.email}</p>
                            <span class="user-role role-${user.role}">${user.role}</span>
                            ${counterBadge}
                        `;
                        
                        connectedUsersList.appendChild(userCard);
                    });
                } else {
                    connectedUsersList.innerHTML = '<p>No users currently connected</p>';
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
    // Check if we're on the admin page
    if (window.location.pathname === '/admin') {
        // Set up socket.io to listen for user connection updates
        if (typeof io !== 'undefined') {
            const socket = io();
            socket.on('userConnectionUpdate', function(data) {
                // Reload connected users when there's an update
                loadConnectedUsers();
            });
        }
        
        // Add a button to show connected users
        const dashboardStatsSection = document.getElementById('dashboardStatsSection');
        if (dashboardStatsSection) {
            const showConnectedUsersBtn = document.createElement('button');
            showConnectedUsersBtn.className = 'btn btn-primary';
            showConnectedUsersBtn.style.marginTop = '20px';
            showConnectedUsersBtn.style.padding = '8px 16px';
            showConnectedUsersBtn.style.backgroundColor = '#28a745';
            showConnectedUsersBtn.style.color = 'white';
            showConnectedUsersBtn.style.border = 'none';
            showConnectedUsersBtn.style.borderRadius = '4px';
            showConnectedUsersBtn.style.cursor = 'pointer';
            showConnectedUsersBtn.innerHTML = '🟢 Show Connected Users';
            
            // Add the button to the dashboard stats section
            dashboardStatsSection.querySelector('.accordion-content').appendChild(showConnectedUsersBtn);
            
            // Add click handler for the button
            showConnectedUsersBtn.addEventListener('click', function() {
                // Show the connected users section
                const connectedUsersSection = document.getElementById('connectedUsersSection');
                if (connectedUsersSection) {
                    // Load connected users
                    loadConnectedUsers();
                    
                    // Activate the section
                    document.querySelectorAll('.accordion-section').forEach(section => {
                        section.classList.remove('active');
                    });
                    connectedUsersSection.classList.add('active');
                    
                    // Scroll to the section
                    connectedUsersSection.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }
        
        // Load connected users initially if the section is visible
        const connectedUsersSection = document.getElementById('connectedUsersSection');
        if (connectedUsersSection && connectedUsersSection.classList.contains('active')) {
            loadConnectedUsers();
        }
    }
});