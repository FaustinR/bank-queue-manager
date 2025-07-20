document.addEventListener('DOMContentLoaded', function() {
    // Setup sidebar toggle
    setupSidebarToggle();
    
    // Fix for links opening in new tabs
    
    // Get all links in the sidebar
    const sidebarLinks = document.querySelectorAll('.sidebar-nav a');
    
    // Add click event listener to each link
    sidebarLinks.forEach(link => {
        // Skip logout link and links with target="_blank"
        if (link.getAttribute('href') !== '/api/auth/logout' && link.getAttribute('target') !== '_blank') {
            // Special handling for history link on admin page
            if (link.getAttribute('href') === '/history' && window.location.pathname === '/admin') {
                // Handle history link to open accordion
                link.onclick = function(e) {
                    e.preventDefault();
                    const historySection = document.getElementById('ticketHistorySection');
                    if (historySection) {
                        historySection.classList.add('active');
                        historySection.scrollIntoView({ behavior: 'smooth' });
                    }
                    return false;
                };
            }
            // Special handling for display screen link on admin page
            else if (link.getAttribute('href') === '/display' && window.location.pathname === '/admin') {
                // Handle display link to show display screen iframe
                link.onclick = function(e) {
                    e.preventDefault();
                    const displayContainer = document.getElementById('displayScreenContainer');
                    if (displayContainer) {
                        displayContainer.style.display = 'block';
                    }
                    return false;
                };
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

// Setup sidebar toggle functionality
function setupSidebarToggle() {
    const toggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (toggleBtn && sidebar) {
        // Check if there's a saved preference
        const sidebarState = localStorage.getItem('sidebarState');
        if (sidebarState === 'folded') {
            sidebar.classList.add('folded');
        }
        
        toggleBtn.addEventListener('click', function() {
            sidebar.classList.toggle('folded');
            
            // Save preference
            if (sidebar.classList.contains('folded')) {
                localStorage.setItem('sidebarState', 'folded');
            } else {
                localStorage.setItem('sidebarState', 'expanded');
            }
        });
    }
}