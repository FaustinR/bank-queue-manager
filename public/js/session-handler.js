// Handle tab close or browser close events
window.addEventListener('beforeunload', async function() {
    try {
        // Send a beacon to clear counter assignment
        // This is more reliable than fetch for beforeunload events
        navigator.sendBeacon('/api/clear-counter-assignment');
    } catch (error) {
        // Cannot log errors during page unload
    }
});

// Also handle page visibility changes (tab switching, minimizing)
let visibilityTimeout;
document.addEventListener('visibilitychange', function() {
    // Clear any existing timeout
    if (visibilityTimeout) {
        clearTimeout(visibilityTimeout);
    }
    
    // If page becomes hidden (tab switch, minimize)
    if (document.visibilityState === 'hidden') {
        // Set a timeout to clear counter after 5 minutes of inactivity
        visibilityTimeout = setTimeout(async function() {
            try {
                await fetch('/api/clear-counter-assignment', { method: 'POST' });
            } catch (error) {
                // Cannot log errors during page unload
            }
        }, 5 * 60 * 1000); // 5 minutes
    }
});