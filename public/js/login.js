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
    
    // Function to check if email is admin (for demo purposes)
    emailInput.addEventListener('blur', function() {
        const email = emailInput.value.toLowerCase();
        if (email.includes('admin')) {
            // Make counter optional for admin emails
            counterSelect.removeAttribute('required');
            counterOptionalText.style.display = 'inline';
            // Show the "No counter" option
            counterSelect.querySelector('option[value=""]').disabled = false;
        } else {
            // Make counter required for non-admin emails
            counterSelect.setAttribute('required', 'required');
            counterOptionalText.style.display = 'none';
            // Hide the "No counter" option
            counterSelect.querySelector('option[value=""]').disabled = true;
            // If "No counter" is selected, reset it
            if (!counterSelect.value) {
                counterSelect.selectedIndex = 0;
            }
        }
    });
    
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
        
        // Reset error message
        loginError.style.display = 'none';
        
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
                
                // Redirect all users to admin dashboard
                window.location.href = '/admin';
            } else {
                // Show error message
                loginError.textContent = data.message || 'Invalid email or password';
                loginError.style.display = 'block';
            }
        } catch (error) {
            loginError.textContent = 'An error occurred. Please try again.';
            loginError.style.display = 'block';
        }
    });
});