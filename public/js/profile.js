document.addEventListener('DOMContentLoaded', function() {
    // Fetch user info
    fetchUserInfo();
    
    // Set up form submission
    const profileForm = document.getElementById('profileForm');
    profileForm.addEventListener('submit', function(e) {
        e.preventDefault();
        updateProfile();
    });
});

async function fetchUserInfo() {
    try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        
        if (response.ok && data.user) {
            // Display user info in header
            document.getElementById('userName').textContent = `${data.user.firstName} ${data.user.lastName}`;
            document.getElementById('userRole').textContent = data.user.role;
            
            // Populate form with user data
            document.getElementById('firstName').value = data.user.firstName;
            document.getElementById('lastName').value = data.user.lastName;
            document.getElementById('email').value = data.user.email;
            document.getElementById('role').value = data.user.role;
            
            // Hide the h2 element completely for non-admin users
            if (data.user.role !== 'admin') {
                const sidebarHeader = document.querySelector('.sidebar-header h2');
                if (sidebarHeader) {
                    sidebarHeader.style.display = 'none';
                }
                
                // Hide admin-only links for non-admin users
                if (data.user.role === 'employee') {
                    document.getElementById('createUserLink').style.display = 'none';
                    document.getElementById('manageUsersLink').style.display = 'none';
                }
            }
        } else {
            // If not authenticated, redirect to login
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Error fetching user info:', error);
    }
}

async function updateProfile() {
    // Get form data
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validate form data
    if (!firstName || !lastName) {
        alert('Please fill in all required fields');
        return;
    }
    
    // Check if passwords match
    if (password && password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }
    
    // Prepare data object
    const userData = {
        firstName,
        lastName
    };
    
    // Only include password if it's provided
    if (password) {
        userData.password = password;
    }
    
    try {
        const response = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Show success message
            const successMessage = document.getElementById('successMessage');
            successMessage.style.display = 'block';
            
            // Update header with new name
            document.getElementById('userName').textContent = `${firstName} ${lastName}`;
            
            // Redirect to dashboard after a brief delay
            setTimeout(() => {
                window.location.href = '/admin';
            }, 1000);
        } else {
            alert(`Error updating profile: ${data.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Error updating profile. Please try again.');
    }
}