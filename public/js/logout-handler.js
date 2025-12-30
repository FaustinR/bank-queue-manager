document.addEventListener('DOMContentLoaded', function() {
    const logoutLinks = document.querySelectorAll('a[href="/api/auth/logout"], a[href="../api/auth/logout"]');
    
    logoutLinks.forEach(link => {
        link.addEventListener('click', async function(e) {
            e.preventDefault();
            
            // Clear all client-side data
            if (typeof clearSocketAuthentication === 'function') {
                clearSocketAuthentication();
            }
            if (typeof socket !== 'undefined' && socket) {
                socket.disconnect();
            }
            localStorage.clear();
            sessionStorage.clear();
            
            // Call logout endpoint
            try {
                await fetch(link.href, { method: 'GET', credentials: 'include' });
            } catch (e) {}
            
            // Force redirect and clear cache
            window.location.replace('/login');
            window.location.href = '/login';
        });
    });
});