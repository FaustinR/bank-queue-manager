// Check for server restarts
document.addEventListener('DOMContentLoaded', async function() {
    // Skip this check on the login page
    if (window.location.pathname === '/login') {
        return;
    }
    
    try {
        // Get current server restart ID
        const response = await fetch('/api/server-restart-id');
        if (!response.ok) {
            return;
        }
        
        const data = await response.json();
        const currentRestartId = data.restartId;
        
        // Get stored restart ID from localStorage
        const storedRestartId = localStorage.getItem('serverRestartId');
        
        // If this is the first visit or server has restarted
        if (!storedRestartId || storedRestartId !== currentRestartId) {
            // Store the new restart ID
            localStorage.setItem('serverRestartId', currentRestartId);
            
            // If this is not the first visit (we had a stored ID)
            if (storedRestartId) {
                // Check if user is non-admin by looking for counter assignment
                const userResponse = await fetch('/api/auth/me');
                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    
                    // If user is not admin, force logout
                    if (userData.user && userData.user.role !== 'admin') {
                        // Redirect to logout which will clear the session
                        window.location.href = '/api/auth/logout';
                    }
                }
            }
        }
    } catch (error) {
        // Error handling without logging
    }
});