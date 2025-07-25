document.addEventListener('DOMContentLoaded', function() {
    // Fetch user info
    fetchUserInfo();
    
    // Fetch users list
    fetchUsers();
    
    // Set up filters
    setupFilters();
    
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

// Store all users for filtering
let allUsers = [];

// Function removed - now handled in connected-users.js

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
                
                // Change "Manage Users" to "Users" if needed
                const usersLink = document.querySelector('a[href="/users"]');
                if (usersLink) {
                    // Find the span element that contains the text
                    const spanElement = usersLink.querySelector('span');
                    if (spanElement) {
                        spanElement.textContent = ' Users';
                    }
                }
                
                // The page title is already set to 'Users' in the HTML
                // This code is kept for backward compatibility
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

// Store current user ID
let currentUserId = null;

async function fetchUsers() {
    try {
        // First get current user ID
        const currentUserResponse = await fetch('/api/users/connected');
        const currentUserData = await currentUserResponse.json();
        if (currentUserResponse.ok && currentUserData.currentUserId) {
            currentUserId = currentUserData.currentUserId;
        }
        
        // Then get all users
        const response = await fetch('/api/users');
        const data = await response.json();
        
        if (response.ok && data.users) {
            // Store all users for filtering
            allUsers = data.users;
            // Display users (apply any active filters)
            applyFilters();
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
    
    // Sort users: current user first, then alphabetically by name
    const sortedUsers = users.sort((a, b) => {
        const aIsCurrent = String(a._id) === String(currentUserId);
        const bIsCurrent = String(b._id) === String(currentUserId);
        
        if (aIsCurrent && !bIsCurrent) return -1;
        if (!aIsCurrent && bIsCurrent) return 1;
        
        // Both are not current user or both are current user, sort by name
        const aName = `${a.firstName} ${a.lastName}`.toLowerCase();
        const bName = `${b.firstName} ${b.lastName}`.toLowerCase();
        return aName.localeCompare(bName);
    });
    
    sortedUsers.forEach(user => {
        const row = document.createElement('tr');
        
        // Check if this is the current user
        const isCurrentUser = String(user._id) === String(currentUserId);
        if (isCurrentUser) {
            row.classList.add('current-user-row');
        }
        
        // Format date with time
        const createdDate = new Date(user.createdAt).toLocaleString();
        
        // Role with styling
        const roleClass = `role-${user.role}`;
        
        // Connected status with styling - ensure it has a default value
        const connected = user.connected || 'no';
        const connectedClass = connected === 'yes' ? 'connected-yes' : 'connected-no';
        
        // Add "You" flag for current user (will be used in the name column)
        const youFlag = isCurrentUser ? '<span class="you-flag">You</span> ' : '';
        const connectedText = connected === 'yes' ? 'Yes' : 'No';
        
        // Check if in read-only mode (supervisor)
        if (window.isReadOnly) {
            row.innerHTML = `
                <td>${youFlag}${user.firstName} ${user.lastName}</td>
                <td>${user.email}</td>
                <td><span class="user-role ${roleClass}">${user.role}</span></td>
                <td><span class="connected-status ${connectedClass}">${connectedText}</span></td>
                <td>${createdDate}</td>
            `;
        } else {
            row.innerHTML = `
                <td>${youFlag}${user.firstName} ${user.lastName}</td>
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

// Set up filter event listeners
function setupFilters() {
    // Get filter elements
    const nameFilter = document.getElementById('nameFilter');
    const emailFilter = document.getElementById('emailFilter');
    const roleFilter = document.getElementById('roleFilter');
    const connectedFilter = document.getElementById('connectedFilter');
    const dateFilter = document.getElementById('dateFilter');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    
    // Add event listeners for each filter
    nameFilter.addEventListener('input', applyFilters);
    emailFilter.addEventListener('input', applyFilters);
    roleFilter.addEventListener('change', applyFilters);
    connectedFilter.addEventListener('change', applyFilters);
    dateFilter.addEventListener('change', applyFilters);
    
    // Add event listener for clear filters button
    clearFiltersBtn.addEventListener('click', clearFilters);
}

// Clear all filters
function clearFilters() {
    // Reset filter inputs
    document.getElementById('nameFilter').value = '';
    document.getElementById('emailFilter').value = '';
    document.getElementById('roleFilter').value = '';
    document.getElementById('connectedFilter').value = '';
    document.getElementById('dateFilter').value = '';
    
    // Apply filters (will show all users since filters are cleared)
    applyFilters();
}

// Apply filters to the users list
function applyFilters() {
    // Get filter values
    const nameFilter = document.getElementById('nameFilter').value.toLowerCase();
    const emailFilter = document.getElementById('emailFilter').value.toLowerCase();
    const roleFilter = document.getElementById('roleFilter').value;
    const connectedFilter = document.getElementById('connectedFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;
    
    // Filter users based on filter values
    const filteredUsers = allUsers.filter(user => {
        // Name filter
        const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
        if (nameFilter && !fullName.includes(nameFilter)) {
            return false;
        }
        
        // Email filter
        if (emailFilter && !user.email.toLowerCase().includes(emailFilter)) {
            return false;
        }
        
        // Role filter
        if (roleFilter && user.role !== roleFilter) {
            return false;
        }
        
        // Connected filter
        if (connectedFilter && (user.connected || 'no') !== connectedFilter) {
            return false;
        }
        
        // Date filter
        if (dateFilter) {
            const userDate = new Date(user.createdAt).toISOString().split('T')[0];
            if (userDate !== dateFilter) {
                return false;
            }
        }
        
        return true;
    });
    
    // Display filtered users
    displayUsers(filteredUsers);
}

// Function removed - now handled in connected-users.js