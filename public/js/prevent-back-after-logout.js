// Prevent accessing authenticated pages after logout using browser back button
(function() {
    // Check if user is on an authenticated page
    const authenticatedPages = ['/admin', '/counter/', '/profile', '/users', '/signup', '/edit-user', '/inbox', '/call-logs', '/connected-users'];
    const currentPath = window.location.pathname;
    
    const isAuthenticatedPage = authenticatedPages.some(page => currentPath.includes(page));
    
    if (isAuthenticatedPage) {
        // Verify session is still valid
        fetch('/api/auth/me', { credentials: 'include' })
            .then(response => {
                if (!response.ok) {
                    // Session invalid, clear everything and redirect
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.replace('/login');
                }
            })
            .catch(() => {
                // Network error or session invalid
                localStorage.clear();
                sessionStorage.clear();
                window.location.replace('/login');
            });
        
        // Prevent caching of authenticated pages
        window.addEventListener('pageshow', function(event) {
            if (event.persisted) {
                // Page was loaded from cache, verify session
                fetch('/api/auth/me', { credentials: 'include' })
                    .then(response => {
                        if (!response.ok) {
                            localStorage.clear();
                            sessionStorage.clear();
                            window.location.replace('/login');
                        }
                    })
                    .catch(() => {
                        localStorage.clear();
                        sessionStorage.clear();
                        window.location.replace('/login');
                    });
            }
        });
    }
})();
