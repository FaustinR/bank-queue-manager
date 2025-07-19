// Make user name clickable on all admin pages and add role icons
document.addEventListener('DOMContentLoaded', function() {
    // Find the user name element
    const userNameElement = document.getElementById('userName');
    
    if (userNameElement && !userNameElement.querySelector('.user-role-icon')) {
        // Fetch user info to get role
        fetch('/api/auth/me')
            .then(response => response.json())
            .then(data => {
                if (data.user) {
                    // Create role icon
                    const roleIcon = document.createElement('span');
                    roleIcon.className = `user-role-icon ${data.user.role}`;
                    
                    // Set icon based on role
                    if (data.user.role === 'admin') {
                        roleIcon.textContent = '👑'; // Crown for admin
                    } else if (data.user.role === 'supervisor') {
                        roleIcon.textContent = '⭐'; // Star for supervisor
                    } else {
                        roleIcon.textContent = '👤'; // Person for employee
                    }
                    
                    // Get the current text content
                    const userName = userNameElement.textContent;
                    
                    // Clear existing content
                    userNameElement.innerHTML = '';
                    
                    // Add icon and name
                    userNameElement.appendChild(roleIcon);
                    userNameElement.appendChild(document.createTextNode(userName));
                    
                    // Make it clickable
                    userNameElement.style.cursor = 'pointer';
                    userNameElement.style.textDecoration = 'underline';
                    userNameElement.style.color = '#2c5aa0';
                    
                    // Add click event listener
                    userNameElement.addEventListener('click', function() {
                        window.location.href = '/profile';
                    });
                }
            })
            .catch(error => console.error('Error fetching user info:', error));
    }
});