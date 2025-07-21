document.addEventListener('DOMContentLoaded', function() {
    const signupForm = document.getElementById('signupForm');
    const signupError = document.getElementById('signupError');
    
    // Fix the signup form in place
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    // Prevent all scroll events
    function preventScroll(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
    
    // Add event listeners for all scroll-related events
    window.addEventListener('wheel', preventScroll, { passive: false });
    window.addEventListener('touchmove', preventScroll, { passive: false });
    window.addEventListener('scroll', preventScroll, { passive: false });
    window.addEventListener('mousewheel', preventScroll, { passive: false });
    window.addEventListener('DOMMouseScroll', preventScroll, { passive: false });
    
    // Function to adjust height of the form
    function adjustHeight() {
        const windowHeight = window.innerHeight;
        const formHeight = signupForm.offsetHeight;
        const headerHeight = document.querySelector('.auth-header').offsetHeight;
        const footerHeight = document.querySelector('.auth-footer').offsetHeight;
        
        // Adjust body height if needed
        if (formHeight + headerHeight + footerHeight > windowHeight) {
            document.body.style.overflow = 'auto';
            document.documentElement.style.overflow = 'auto';
        }
    }
    
    // Run on load and resize
    adjustHeight();
    window.addEventListener('resize', adjustHeight);
    
    signupForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const role = document.getElementById('role').value;
        
        // Reset error message
        signupError.style.display = 'none';
        
        // Validate passwords match
        if (password !== confirmPassword) {
            signupError.textContent = 'Passwords do not match';
            signupError.style.display = 'block';
            return;
        }
        
        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ firstName, lastName, email, password, role })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Show success and redirect
                alert('User created successfully!');
                window.location.href = '/admin';
            } else {
                // Show error message
                signupError.textContent = data.message || 'Error creating user';
                signupError.style.display = 'block';
            }
        } catch (error) {
            console.error('Signup error:', error);
            signupError.textContent = 'An error occurred. Please try again.';
            signupError.style.display = 'block';
        }
    });
});