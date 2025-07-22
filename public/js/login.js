document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const emailInput = document.getElementById('email');
    const counterSelect = document.getElementById('counter');
    const systemNotification = document.getElementById('systemNotification');
    
    const counterOptionalText = document.getElementById('counterOptionalText');
    
    // Check URL parameters to see if we need to show the system restart notification
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('restart') || sessionStorage.getItem('systemRestarted')) {
        systemNotification.style.display = 'block';
        sessionStorage.setItem('systemRestarted', 'true');
    }
    
    // Make counter optional for all users
    counterSelect.removeAttribute('required');
    counterOptionalText.style.display = 'inline';
    counterSelect.querySelector('option[value=""]').disabled = false;
    
    // Check if counter is occupied when counter selection changes
    counterSelect.addEventListener('change', async function() {
        const counterId = counterSelect.value;
        if (!counterId) return;
        
        try {
            const response = await fetch(`/api/counters/${counterId}/check`);
            const data = await response.json();
            
            if (data.occupied && data.staffName && 
                data.staffName !== null && 
                data.staffName !== 'null' && 
                data.staffName !== 'undefined') {
                // Only block selection if counter is occupied by a real staff member
                loginError.textContent = `Counter ${counterId} is already occupied by ${data.staffName}. Please select another counter.`;
                loginError.style.display = 'block';
                counterSelect.value = ''; // Reset selection
            } else {
                // If counter was showing as occupied but with null staffName, it's been cleared
                loginError.style.display = 'none';
            }
        } catch (error) {
            // Silently fail, will be caught during form submission if needed
        }
    });
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = emailInput.value;
        const password = document.getElementById('password').value;
        const counter = counterSelect.value;
        const loginButton = document.getElementById('loginButton');
        
        // Reset error message
        loginError.style.display = 'none';
        
        // Show spinner
        loginButton.classList.add('loading');
        loginButton.disabled = true;
        
        // If counter is selected, check if it's occupied by a REAL staff member
        if (counter) {
            try {
                const checkResponse = await fetch(`/api/counters/${counter}/check`);
                const checkData = await checkResponse.json();
                
                // Only block login if counter is occupied by a real staff member with a valid name
                if (checkData.occupied && checkData.staffName && 
                    checkData.staffName !== null && 
                    checkData.staffName !== 'null' && 
                    checkData.staffName !== 'undefined') {
                    loginError.textContent = `Counter ${counter} is already occupied by ${checkData.staffName}. Please select another counter.`;
                    loginError.style.display = 'block';
                    return;
                }
                // If counter shows as occupied but has null staffName, we'll allow login anyway
                // The server will clear the invalid assignment during login
            } catch (error) {
                // Continue with login attempt even if check fails
            }
        }
        
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
                    // Counter staff update notification sent from client
                } catch (notifyError) {
                    // Error handling without logging
                }
                
                // Authenticate socket with user ID
                if (data.user && data.user._id) {
                    authenticateSocket(data.user._id);
                }
                
                // Redirect all users to admin dashboard
                window.location.href = '/admin';
            } else {
                // Show error message
                loginError.textContent = data.message || 'Invalid email or password';
                loginError.style.display = 'block';
                
                // Hide spinner
                loginButton.classList.remove('loading');
                loginButton.disabled = false;
                
                // If the error is about already being logged in at another counter, make it more visible
                if (data.message && data.message.includes('You are already logged in at Counter')) {
                    loginError.style.color = '#e74c3c';
                    loginError.style.fontWeight = 'bold';
                    loginError.style.padding = '10px';
                    loginError.style.backgroundColor = '#fff3cd';
                    loginError.style.border = '1px solid #ffeeba';
                    loginError.style.borderRadius = '4px';
                }
            }
        } catch (error) {
            loginError.textContent = 'An error occurred. Please try again.';
            loginError.style.display = 'block';
            
            // Hide spinner
            loginButton.classList.remove('loading');
            loginButton.disabled = false;
        }
    });
});