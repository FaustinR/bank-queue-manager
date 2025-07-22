document.addEventListener('DOMContentLoaded', function() {
    // Check if we're in an iframe
    if (document.body.classList.contains('in-iframe')) {
        return; // Skip sidebar setup if in iframe
    }
    
    // Setup sidebar toggle
    setupSidebarToggle();
    
    // Fix for links opening in new tabs
    
    // Get all links in the sidebar
    const sidebarLinks = document.querySelectorAll('.sidebar-nav a');
    
    // Add click event listener to each link
    sidebarLinks.forEach(link => {
        // For links with target="_blank", add session token to URL
        if (link.getAttribute('target') === '_blank' && 
            (link.getAttribute('href') === '/history' || link.getAttribute('href') === '/display')) {
            link.onclick = function(e) {
                e.preventDefault();
                // Open in new tab with session cookie preserved
                window.open(this.getAttribute('href'), '_blank');
                return false;
            };
        }
        // Skip logout link and other links with target="_blank"
        else if (link.getAttribute('href') !== '/api/auth/logout' && link.getAttribute('target') !== '_blank') {
            // Special handling for dashboard link on admin page
            if (link.getAttribute('href') === '/admin' && window.location.pathname === '/admin') {
                // Handle dashboard link to scroll to top
                link.onclick = function(e) {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    return false;
                };
            }
            // Special handling for history link
            else if (link.getAttribute('href') === '/history') {
                // Handle history link
                link.onclick = function(e) {
                    e.preventDefault();
                    if (window.location.pathname === '/admin') {
                        // On admin page, open the accordion
                        const historySection = document.getElementById('ticketHistorySection');
                        if (historySection) {
                            historySection.classList.add('active');
                            historySection.scrollIntoView({ behavior: 'smooth' });
                            return false;
                        }
                    } else {
                        // From other pages, go to admin page with history section
                        window.location.href = '/admin?section=history';
                    }
                    return false;
                };
            }
            // Special handling for display screen link
            else if (link.getAttribute('href') === '/display') {
                // Handle display link
                link.onclick = function(e) {
                    e.preventDefault();
                    if (window.location.pathname === '/admin') {
                        // On admin page, show the display screen accordion
                        const displaySection = document.getElementById('displayScreenSection');
                        if (displaySection) {
                            displaySection.classList.add('active');
                            // Wait a moment for the display to become visible before scrolling
                            setTimeout(() => {
                                displaySection.scrollIntoView({ behavior: 'smooth' });
                            }, 100);
                            return false;
                        }
                    } else {
                        // From other pages, go to admin page with display section
                        window.location.href = '/admin?section=display';
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
        // Only check user role on admin pages
        if (window.location.pathname.includes('/admin')) {
            // Get user role
            fetch('/api/auth/me')
                .then(response => response.json())
                .then(data => {
                    if (data.user && data.user.role !== 'admin') {
                        // Hide the h2 element completely for non-admin users
                        sidebar.style.display = 'none';
                    }
                })
                .catch(error => {
                    // If error, just continue without changing anything
                });
        }
    }
});

// Setup sidebar toggle functionality
function setupSidebarToggle() {
    // Skip if in iframe
    if (document.body.classList.contains('in-iframe')) {
        return;
    }
    
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