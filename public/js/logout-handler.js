document.addEventListener('DOMContentLoaded', function() {
    // Find all logout links
    const logoutLinks = document.querySelectorAll('a[href="/api/auth/logout"]');
    
    logoutLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Clear socket authentication
            if (typeof clearSocketAuthentication === 'function') {
                console.log('Clearing socket authentication');
                clearSocketAuthentication();
            } else {
                console.error('clearSocketAuthentication function not found');
            }
            
            // Continue with normal logout
            // No need to prevent default as we want the normal logout to proceed
        });
    });
});