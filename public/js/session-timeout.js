// Session timeout handler
(function() {
    // Configuration
    const TIMEOUT_MINUTES = 30; // Logout after 30 minutes of inactivity
    const WARNING_BEFORE_TIMEOUT_SECONDS = 60; // Show warning 60 seconds before timeout
    
    let timeoutID;
    let warningID;
    let warningShown = false;
    
    // Create warning modal
    const warningModal = document.createElement('div');
    warningModal.className = 'timeout-warning-modal';
    warningModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.3s, visibility 0.3s;
    `;
    
    const warningContent = document.createElement('div');
    warningContent.className = 'timeout-warning-content';
    warningContent.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 8px;
        max-width: 400px;
        text-align: center;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    `;
    
    warningContent.innerHTML = `
        <h3 style="margin-top: 0; color: #e74c3c;">Session Timeout Warning</h3>
        <p>Your session will expire in <span id="timeoutCountdown">60</span> seconds due to inactivity.</p>
        <p>Click the button below to continue your session.</p>
        <button id="continueSessionBtn" style="
            background: #2c5aa0;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
        ">Continue Session</button>
    `;
    
    warningModal.appendChild(warningContent);
    document.body.appendChild(warningModal);
    
    // Create timeout modal
    const timeoutModal = document.createElement('div');
    timeoutModal.className = 'timeout-modal';
    timeoutModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.3s, visibility 0.3s;
    `;
    
    const timeoutContent = document.createElement('div');
    timeoutContent.className = 'timeout-content';
    timeoutContent.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 8px;
        max-width: 400px;
        text-align: center;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    `;
    
    timeoutContent.innerHTML = `
        <h3 style="margin-top: 0; color: #e74c3c;">Session Expired</h3>
        <p>Your session has expired due to inactivity.</p>
        <p>Please log in again to continue.</p>
        <button id="loginAgainBtn" style="
            background: #2c5aa0;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
        ">Log In Again</button>
    `;
    
    timeoutModal.appendChild(timeoutContent);
    document.body.appendChild(timeoutModal);
    
    // Event listeners
    document.getElementById('continueSessionBtn').addEventListener('click', function() {
        resetTimeout();
        hideWarning();
    });
    
    document.getElementById('loginAgainBtn').addEventListener('click', function() {
        window.location.href = '/login';
    });
    
    // Functions
    function startTimeout() {
        clearTimeout(timeoutID);
        clearTimeout(warningID);
        warningShown = false;
        
        // Set timeout for warning
        warningID = setTimeout(function() {
            showWarning();
        }, (TIMEOUT_MINUTES * 60 * 1000) - (WARNING_BEFORE_TIMEOUT_SECONDS * 1000));
        
        // Set timeout for logout
        timeoutID = setTimeout(function() {
            logout();
        }, TIMEOUT_MINUTES * 60 * 1000);
    }
    
    function resetTimeout() {
        startTimeout();
    }
    
    function showWarning() {
        warningShown = true;
        warningModal.style.opacity = '1';
        warningModal.style.visibility = 'visible';
        
        // Start countdown
        let secondsLeft = WARNING_BEFORE_TIMEOUT_SECONDS;
        const countdownElement = document.getElementById('timeoutCountdown');
        countdownElement.textContent = secondsLeft;
        
        const countdownInterval = setInterval(function() {
            secondsLeft--;
            countdownElement.textContent = secondsLeft;
            
            if (secondsLeft <= 0) {
                clearInterval(countdownInterval);
            }
        }, 1000);
    }
    
    function hideWarning() {
        warningShown = false;
        warningModal.style.opacity = '0';
        warningModal.style.visibility = 'hidden';
    }
    
    function logout() {
        // Hide warning if shown
        if (warningShown) {
            hideWarning();
        }
        
        // Show timeout modal
        timeoutModal.style.opacity = '1';
        timeoutModal.style.visibility = 'visible';
        
        // Call logout API using direct navigation
        window.location.href = '/api/auth/logout';
    }
    
    // Activity detection
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    activityEvents.forEach(function(eventName) {
        document.addEventListener(eventName, function() {
            if (!warningShown) {
                resetTimeout();
            }
        }, true);
    });
    
    // Initialize timeout
    startTimeout();
})();