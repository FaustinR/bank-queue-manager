// Check for server restarts
document.addEventListener('DOMContentLoaded', async function() {
    // Skip this check on the login page
    if (window.location.pathname === '/login') {
        return;
    }
    
    // Prevent infinite loops by checking if we've recently checked
    const lastCheckTime = parseInt(sessionStorage.getItem('lastRestartCheckTime') || '0');
    const now = Date.now();
    
    // Only check once every 5 minutes
    if (now - lastCheckTime < 5 * 60 * 1000) {
        return;
    }
    
    // Update the last check time
    sessionStorage.setItem('lastRestartCheckTime', now.toString());
    
    try {
        // Check if user is non-admin by looking for counter assignment
        const userResponse = await fetch('/api/auth/me');
        if (!userResponse.ok) {
            return;
        }
        
        const userData = await userResponse.json();
        
        // Only proceed with restart check for non-admin users
        if (!userData.user || userData.user.role === 'admin') {
            return;
        }
        
        // For non-admin users, check if they have a counter assigned
        if (!userData.user.counter) {
            // If no counter is assigned, redirect to logout
            window.location.href = '/api/auth/logout';
            return;
        }
    } catch (error) {
        // Error handling without logging
    }
});