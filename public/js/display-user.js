// Function to get current user's email
async function getCurrentUserEmail() {
    try {
        // First try to get from server if user is logged in
        const response = await fetch('/api/user/current');
        if (response.ok) {
            const userData = await response.json();
            if (userData.email) {
                return userData.email;
            }
        }
        
        // Fallback to stored values
        let storedEmail = null;
        
        // Try localStorage
        if (typeof(Storage) !== "undefined" && localStorage) {
            storedEmail = localStorage.getItem('senderEmail');
        }
        
        // Try sessionStorage as fallback
        if (!storedEmail && typeof(Storage) !== "undefined" && sessionStorage) {
            storedEmail = sessionStorage.getItem('senderEmail');
        }
        
        // Try window object as Edge fallback
        if (!storedEmail && window.storedSenderEmail) {
            storedEmail = window.storedSenderEmail;
        }
        
        return storedEmail || '';
    } catch (error) {
        // Final fallback for Edge
        return window.storedSenderEmail || '';
    }
}

// Function to get current user's name
async function getCurrentUserName() {
    try {
        // First try to get from server if user is logged in
        const response = await fetch('/api/user/current');
        if (response.ok) {
            const userData = await response.json();
            if (userData.name) {
                return userData.name;
            }
        }
        
        // Fallback to stored values
        let storedName = null;
        
        // Try localStorage
        if (typeof(Storage) !== "undefined" && localStorage) {
            storedName = localStorage.getItem('senderName');
        }
        
        // Try sessionStorage as fallback
        if (!storedName && typeof(Storage) !== "undefined" && sessionStorage) {
            storedName = sessionStorage.getItem('senderName');
        }
        
        // Try window object as Edge fallback
        if (!storedName && window.storedSenderName) {
            storedName = window.storedSenderName;
        }
        
        return storedName || '';
    } catch (error) {
        // Final fallback for Edge
        return window.storedSenderName || '';
    }
}