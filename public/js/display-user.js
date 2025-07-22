// Function to get current user's email
async function getCurrentUserEmail() {
    try {
        // Try to get from localStorage first
        const storedEmail = localStorage.getItem('senderEmail');
        if (storedEmail) {
            return storedEmail;
        }
        
        // For display screen, we don't need to get from server
        // Just return empty string and let user enter their email
        return '';
    } catch (error) {
        return '';
    }
}