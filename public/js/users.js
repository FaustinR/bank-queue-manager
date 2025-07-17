document.addEventListener('DOMContentLoaded', function() {
    // Fetch user info
    fetchUserInfo();
    
    // Fetch users list
    fetchUsers();
    
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
});

async function fetchUserInfo() {
    try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        
        if (response.ok && data.user) {
            document.getElementById('userName').textContent = `${data.user.firstName} ${data.user.lastName}`;
            document.getElementById('userRole').textContent = data.user.role;
            
            // Check if user is admin or supervisor
            if (data.user.role === 'admin') {
                // Admin has full access
            } else if (data.user.role === 'supervisor') {
                // Supervisor has read-only access
                const roleElement = document.getElementById('userRole');
                roleElement.textContent = 'supervisor (read-only)';
                roleElement.style.backgroundColor = '#fd7e14';
                
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
            } else {
                // Redirect other users
                window.location.href = '/display';
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
                `<tr><td colspan="5">Error loading users: ${data.message || 'Unknown error'}</td></tr>`;
        }
    } catch (error) {
        console.error('Error fetching users:', error);
        document.getElementById('usersTableBody').innerHTML = 
            '<tr><td colspan="5">Error loading users. Please try again.</td></tr>';
    }
}

function displayUsers(users) {
    const tableBody = document.getElementById('usersTableBody');
    tableBody.innerHTML = '';
    
    if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">No users found</td></tr>';
        return;
    }
    
    users.forEach(user => {
        const row = document.createElement('tr');
        
        // Format date
        const createdDate = new Date(user.createdAt).toLocaleDateString();
        
        // Role with styling
        const roleClass = `role-${user.role}`;
        
        // Check if in read-only mode (supervisor)
        if (window.isReadOnly) {
            row.innerHTML = `
                <td>${user.firstName} ${user.lastName}</td>
                <td>${user.email}</td>
                <td><span class="user-role ${roleClass}">${user.role}</span></td>
                <td>${createdDate}</td>
            `;
        } else {
            row.innerHTML = `
                <td>${user.firstName} ${user.lastName}</td>
                <td>${user.email}</td>
                <td><span class="user-role ${roleClass}">${user.role}</span></td>
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