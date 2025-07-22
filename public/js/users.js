document.addEventListener('DOMContentLoaded', function() {
    // Fetch user info
    fetchUserInfo();
    
    // Fetch users list
    fetchUsers();
    
    // Load connected users
    loadConnectedUsers();
    
    // Modal functionality
    const modal = document.getElementById('deleteModal');
    const cancelDelete = document.getElementById('cancelDelete');
    
    cancelDelete.addEventListener('click', function() {
        modal.classList.remove('show');
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.classList.remove('show');
        }
    });
    
    // Set up socket.io to listen for user connection updates
    if (typeof io !== 'undefined') {
        const socket = io();
        socket.on('userConnectionUpdate', function(data) {
            // Refresh the users list when a user connects or disconnects
            fetchUsers();
            // Reload connected users
            loadConnectedUsers();
        });
    }
});

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

async function fetchUserInfo() {
    try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        
        if (response.ok && data.user) {
            document.getElementById('userName').textContent = `${data.user.firstName} ${data.user.lastName}`;
            document.getElementById('userRole').textContent = data.user.role;
            
            // Hide the h2 element completely for non-admin users
            if (data.user.role !== 'admin') {
                const sidebarHeader = document.querySelector('.sidebar-header h2');
                if (sidebarHeader) {
                    sidebarHeader.style.display = 'none';
                }
            }
            
            // Check if user is admin or supervisor
            if (data.user.role === 'admin') {
                // Admin has full access
            } else if (data.user.role === 'supervisor' || data.user.role === 'employee') {
                // Supervisor and employee have read-only access
                const roleElement = document.getElementById('userRole');
                roleElement.textContent = `${data.user.role} (read-only)`;
                roleElement.style.backgroundColor = data.user.role === 'supervisor' ? '#fd7e14' : '#28a745';
                
                // Hide the add user button
                const addUserBtn = document.querySelector('.add-user-btn');
                if (addUserBtn) addUserBtn.style.display = 'none';
                
                // Hide the Create User link in sidebar
                const signupLinks = document.querySelectorAll('a[href="/signup"]');
                signupLinks.forEach(link => {
                    // Hide the entire list item, not just the link
                    const listItem = link.closest('li');
                    if (listItem) {
                        listItem.style.display = 'none';
                    } else {
                        link.style.display = 'none';
                    }
                });
                
                // Change "Manage Users" to "Users"
                const usersLink = document.querySelector('a[href="/users"]');
                if (usersLink) {
                    // Find the text node (which contains "Manage Users")
                    for (let i = 0; i < usersLink.childNodes.length; i++) {
                        if (usersLink.childNodes[i].nodeType === Node.TEXT_NODE) {
                            usersLink.childNodes[i].textContent = ' Users';
                            break;
                        }
                    }
                }
                
                // Also change the page title
                const pageTitle = document.querySelector('.content-header h1');
                if (pageTitle && pageTitle.textContent === 'Manage Users') {
                    pageTitle.textContent = 'Users';
                }
                
                // Hide the Actions column header
                const tableHeaders = document.querySelectorAll('.users-table th');
                tableHeaders.forEach(th => {
                    if (th.textContent === 'Actions') {
                        th.style.display = 'none';
                    }
                });
                
                // Set a global flag for read-only mode
                window.isReadOnly = true;
            }
        } else {
            // If not authenticated, redirect to login
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Error fetching user info:', error);
    }
}

async function fetchUsers() {
    try {
        const response = await fetch('/api/users');
        const data = await response.json();
        
        if (response.ok && data.users) {
            displayUsers(data.users);
        } else {
            document.getElementById('usersTableBody').innerHTML = 
                `<tr><td colspan="6">Error loading users: ${data.message || 'Unknown error'}</td></tr>`;
        }
    } catch (error) {
        console.error('Error fetching users:', error);
        document.getElementById('usersTableBody').innerHTML = 
            '<tr><td colspan="6">Error loading users. Please try again.</td></tr>';
    }
}

function displayUsers(users) {
    const tableBody = document.getElementById('usersTableBody');
    tableBody.innerHTML = '';
    
    if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6">No users found</td></tr>';
        return;
    }
    
    users.forEach(user => {
        const row = document.createElement('tr');
        
        // Format date
        const createdDate = new Date(user.createdAt).toLocaleDateString();
        
        // Role with styling
        const roleClass = `role-${user.role}`;
        
        // Connected status with styling - ensure it has a default value
        const connected = user.connected || 'no';
        const connectedClass = connected === 'yes' ? 'connected-yes' : 'connected-no';
        const connectedText = connected === 'yes' ? 'Yes' : 'No';
        
        // Check if in read-only mode (supervisor)
        if (window.isReadOnly) {
            row.innerHTML = `
                <td>${user.firstName} ${user.lastName}</td>
                <td>${user.email}</td>
                <td><span class="user-role ${roleClass}">${user.role}</span></td>
                <td><span class="connected-status ${connectedClass}">${connectedText}</span></td>
                <td>${createdDate}</td>
            `;
        } else {
            row.innerHTML = `
                <td>${user.firstName} ${user.lastName}</td>
                <td>${user.email}</td>
                <td><span class="user-role ${roleClass}">${user.role}</span></td>
                <td><span class="connected-status ${connectedClass}">${connectedText}</span></td>
                <td>${createdDate}</td>
                <td class="user-actions">
                    <button class="edit-btn" data-id="${user._id}">Edit</button>
                    <button class="delete-btn" data-id="${user._id}">Delete</button>
                </td>
            `;
        }
        
        tableBody.appendChild(row);
    });
    
    // Add event listeners to buttons only if not in read-only mode
    if (!window.isReadOnly) {
        addButtonEventListeners();
    }
}

function addButtonEventListeners() {
    // Edit buttons
    document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.getAttribute('data-id');
            window.location.href = `/edit-user/${userId}`;
        });
    });
    
    // Delete buttons
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.getAttribute('data-id');
            showDeleteConfirmation(userId);
        });
    });
}

function showDeleteConfirmation(userId) {
    const modal = document.getElementById('deleteModal');
    const confirmDelete = document.getElementById('confirmDelete');
    
    // Set up the confirm button with the user ID
    confirmDelete.setAttribute('data-id', userId);
    
    // Remove any existing event listeners
    confirmDelete.replaceWith(confirmDelete.cloneNode(true));
    
    // Add new event listener
    document.getElementById('confirmDelete').addEventListener('click', async function() {
        const userId = this.getAttribute('data-id');
        await deleteUser(userId);
        modal.classList.remove('show');
    });
    
    // Show the modal
    modal.classList.add('show');
}

async function deleteUser(userId) {
    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Refresh the users list
            fetchUsers();
        } else {
            alert(`Error deleting user: ${data.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error deleting user. Please try again.');
    }
}