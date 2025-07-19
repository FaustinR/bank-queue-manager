document.addEventListener('DOMContentLoaded', function() {
    // Fetch user info
    fetchUserInfo();
    
    // Get user ID from URL
    const userId = window.location.pathname.split('/').pop();
    
    // Fetch user data
    fetchUserData(userId);
    
    // Set up form submission
    const editUserForm = document.getElementById('editUserForm');
    editUserForm.addEventListener('submit', function(e) {
        e.preventDefault();
        updateUser(userId);
    });
});

async function fetchUserInfo() {
    try {
        const response = await fetch('../api/auth/me');
        const data = await response.json();
        
        if (response.ok && data.user) {
            document.getElementById('userName').textContent = `${data.user.firstName} ${data.user.lastName}`;
            document.getElementById('userRole').textContent = data.user.role;
            
            // Check if user is admin
            if (data.user.role !== 'admin') {
                // Redirect non-admin users
                window.location.href = '../users';
            }
            
            // Hide the h2 element completely for non-admin users
            if (data.user.role !== 'admin') {
                const sidebarHeader = document.querySelector('.sidebar-header h2');
                if (sidebarHeader) {
                    sidebarHeader.style.display = 'none';
                }
            }
        } else {
            // If not authenticated, redirect to login
            window.location.href = '../login';
        }
    } catch (error) {
        console.error('Error fetching user info:', error);
    }
}

async function fetchUserData(userId) {
    try {
        const response = await fetch(`../api/users/${userId}`);
        const data = await response.json();
        
        if (response.ok && data.user) {
            // Populate form with user data
            document.getElementById('firstName').value = data.user.firstName;
            document.getElementById('lastName').value = data.user.lastName;
            document.getElementById('email').value = data.user.email;
            document.getElementById('role').value = data.user.role;
        } else {
            alert(`Error loading user: ${data.message || 'User not found'}`);
            window.location.href = '../users';
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
        alert('Error loading user data. Please try again.');
        window.location.href = '../users';
    }
}

async function updateUser(userId) {
    // Get form data
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('email').value.trim();
    const role = document.getElementById('role').value;
    const password = document.getElementById('password').value;
    
    // Validate form data
    if (!firstName || !lastName || !email || !role) {
        alert('Please fill in all required fields');
        return;
    }
    
    // Prepare data object
    const userData = {
        firstName,
        lastName,
        email,
        role
    };
    
    // Only include password if it's provided
    if (password) {
        userData.password = password;
    }
    
    try {
        const response = await fetch(`../api/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('User updated successfully');
            window.location.href = '../users';
        } else {
            alert(`Error updating user: ${data.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error updating user:', error);
        alert('Error updating user. Please try again.');
    }
}