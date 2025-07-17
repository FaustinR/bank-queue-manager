document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        // Reset error message
        loginError.style.display = 'none';
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Redirect based on role
                if (data.user.role === 'admin' || data.user.role === 'supervisor') {
                    window.location.href = '/admin';
                } else {
                    window.location.href = '/display';
                }
            } else {
                // Show error message
                loginError.textContent = data.message || 'Invalid email or password';
                loginError.style.display = 'block';
            }
        } catch (error) {
            console.error('Login error:', error);
            loginError.textContent = 'An error occurred. Please try again.';
            loginError.style.display = 'block';
        }
    });
});