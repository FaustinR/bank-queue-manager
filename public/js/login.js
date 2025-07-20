document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const counter = document.getElementById('counter').value;
        
        console.log('Login attempt with counter:', counter);
        
        // Reset error message
        loginError.style.display = 'none';
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password, counter })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Notify about counter staff update before redirecting
                try {
                    await fetch('/api/notify-counter-update', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({})
                    });
                    console.log('Counter staff update notification sent from client');
                } catch (notifyError) {
                    console.error('Error notifying counter staff update from client:', notifyError);
                }
                
                // Redirect all users to admin dashboard
                window.location.href = '/admin';
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