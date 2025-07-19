document.addEventListener('DOMContentLoaded', function() {
    // Fix for links opening in new tabs
    
    // Get all links in the sidebar
    const sidebarLinks = document.querySelectorAll('.sidebar-nav a');
    
    // Add click event listener to each link
    sidebarLinks.forEach(link => {
        // Skip logout link and links with target="_blank"
        if (link.getAttribute('href') !== '/api/auth/logout' && link.getAttribute('target') !== '_blank') {
            // Special handling for history and display links on admin page
            if ((link.getAttribute('href') === '/history' || link.getAttribute('href') === '/display') && 
                window.location.pathname === '/admin') {
                // Don't add the default click handler, it will be handled by admin.js
            } else {
                // Force the link to open in the same tab
                link.onclick = function(e) {
                    e.preventDefault();
                    window.location.href = this.getAttribute('href');
                    return false;
                };
            }
        }
    });
    
    // Also handle navigation links in the header if they exist
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        if (link.getAttribute('target') !== '_blank') {
            link.onclick = function(e) {
                e.preventDefault();
                window.location.href = this.getAttribute('href');
                return false;
            };
        }
    });
    
    // Check if we're on a page with a sidebar
    const sidebar = document.querySelector('.sidebar-header h2');
    if (sidebar) {
        // Get user role
        fetch('/api/auth/me')
            .then(response => response.json())
            .then(data => {
                if (data.user && data.user.role !== 'admin') {
                    // Hide the h2 element completely for non-admin users
                    sidebar.style.display = 'none';
                }
            })
            .catch(error => console.error('Error fetching user info:', error));
    }
});