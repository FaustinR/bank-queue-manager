// Function to get current user's email
async function getCurrentUserEmail() {
    try {
        // Try to get from localStorage first
        const storedEmail = localStorage.getItem('senderEmail');
        if (storedEmail) {
            return storedEmail;
        }
        
        // If not in localStorage, try to get from server
        const response = await fetch('/api/auth/me');
        if (response.ok) {
            const data = await response.json();
            if (data.user && data.user.email) {
                localStorage.setItem('senderEmail', data.user.email);
                return data.user.email;
            }
        }
        
        return '';
    } catch (error) {
        return '';
    }
}