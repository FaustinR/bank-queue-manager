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
                    roleIcon.style.display = 'inline-block';
                    roleIcon.style.visibility = 'visible';
                    
                    // Show icon for all roles
                    if (data.user.role === 'admin') {
                        roleIcon.innerHTML = '<i class="fas fa-user-shield"></i>'; // Shield for admin
                        roleIcon.style.backgroundColor = '#dc3545';
                    } else if (data.user.role === 'supervisor') {
                        roleIcon.innerHTML = '<i class="fas fa-star"></i>'; // Star for supervisor
                        roleIcon.style.backgroundColor = '#fd7e14';
                    } else {
                        roleIcon.innerHTML = '<i class="fas fa-user"></i>'; // User for employee
                        roleIcon.style.backgroundColor = '#20c997';
                    }
                    roleIcon.style.fontWeight = 'normal';
                    roleIcon.style.fontSize = '12px';
                    roleIcon.style.color = 'white';
                    roleIcon.style.width = '24px';
                    roleIcon.style.height = '24px';
                    roleIcon.style.borderRadius = '50%';
                    roleIcon.style.textAlign = 'center';
                    roleIcon.style.lineHeight = '24px';
                    roleIcon.style.marginRight = '8px';
                    roleIcon.style.fontSize = '16px';
                    roleIcon.style.verticalAlign = 'middle';
                    
                    // Get the current text content - extract just the name without counter info
                    let userName = userNameElement.textContent;
                    // Remove counter information if present
                    if (userName.includes('(Counter')) {
                        userName = userName.substring(0, userName.indexOf('(Counter')).trim();
                    }
                    
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