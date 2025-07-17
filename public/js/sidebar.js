document.addEventListener('DOMContentLoaded', function() {
    // Fix for links opening in new tabs
    
    // Get all links in the sidebar
    const sidebarLinks = document.querySelectorAll('.sidebar-nav a');
    
    // Add click event listener to each link
    sidebarLinks.forEach(link => {
        // Skip logout link and links with target="_blank"
        if (link.getAttribute('href') !== '/api/auth/logout' && link.getAttribute('target') !== '_blank') {
            // Force the link to open in the same tab
            link.onclick = function(e) {
                e.preventDefault();
                window.location.href = this.getAttribute('href');
                return false;
            };
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
});