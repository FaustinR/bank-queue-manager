// Only clear counter on actual tab close, not on refresh
window.addEventListener('beforeunload', function(event) {
    // Skip for admin page, history, and display pages
    if (window.location.pathname === '/admin' || 
        window.location.pathname === '/history' || 
        window.location.pathname === '/display') {
        return;
    }
    
    // Only proceed for counter pages
    if (!window.location.pathname.startsWith('/counter/')) {
        return;
    }
    
    // This is a counter page being closed, send the beacon
    navigator.sendBeacon('/api/clear-counter-assignment');
});



// Handle visibility changes only for counter pages
let visibilityTimeout;
document.addEventListener('visibilitychange', function() {
    // Skip for admin page, history, and display pages
    if (window.location.pathname === '/admin' || 
        window.location.pathname === '/history' || 
        window.location.pathname === '/display') {
        return;
    }
    
    // Only proceed for counter pages
    if (!window.location.pathname.startsWith('/counter/')) {
        return;
    }
    
    // Clear any existing timeout
    if (visibilityTimeout) {
        clearTimeout(visibilityTimeout);
    }
    
    // If page becomes hidden (tab switch, minimize)
    if (document.visibilityState === 'hidden') {
        // Set a timeout to clear counter after 5 minutes of inactivity
        visibilityTimeout = setTimeout(function() {
            fetch('/api/clear-counter-assignment', { method: 'POST' });
        }, 5 * 60 * 1000); // 5 minutes
    }
});