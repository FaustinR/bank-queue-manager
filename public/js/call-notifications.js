// Simple persistent call notification system
(function() {
    let currentNotification = null;

    // Show call notification
    function showCallNotification(callData) {
        // Remove existing notification
        if (currentNotification) {
            currentNotification.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.id = 'callNotification';
        notification.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: ${callData.type === 'incoming' ? '#28a745' : '#007bff'};
            color: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 99999;
            font-family: Arial, sans-serif;
            min-width: 350px;
            max-width: 450px;
        `;

        // Create notification content
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="background: rgba(255,255,255,0.2); border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-phone${callData.type === 'outgoing' ? '' : '-alt'}" style="font-size: 20px;"></i>
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">
                        ${callData.type === 'incoming' ? 'Incoming Call' : 'Outgoing Call'}
                    </div>
                    <div style="font-size: 14px; margin-bottom: 4px;">
                        <strong>Name:</strong> ${callData.name}
                    </div>
                    <div style="font-size: 14px; margin-bottom: 4px;">
                        <strong>Counter:</strong> Counter ${callData.counter}
                    </div>
                    <div style="font-size: 14px;">
                        <strong>Service:</strong> ${callData.service}
                    </div>
                </div>
            </div>
        `;

        // Add to page
        document.body.appendChild(notification);
        currentNotification = notification;

        // Add CSS for font awesome if not already present
        if (!document.querySelector('link[href*="font-awesome"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
            document.head.appendChild(link);
        }
    }

    // Hide call notification
    function hideCallNotification() {
        if (currentNotification) {
            currentNotification.remove();
            currentNotification = null;
        }
    }

    // Global functions
    window.showCallNotification = showCallNotification;
    window.hideCallNotification = hideCallNotification;
    
    // Function to show outgoing call notification
    window.showOutgoingCallNotification = function(recipientName, counter, service) {
        showCallNotification({
            type: 'outgoing',
            name: recipientName,
            counter: counter || 'Unknown',
            service: service || 'Unknown Service'
        });
    };
    
    // Function to show notification on parent window (for iframe calls)
    window.showCallNotificationOnParent = function(callData) {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'showCallNotification',
                callData: callData
            }, '*');
        }
    };
    
    // Function to hide notification on parent window
    window.hideCallNotificationOnParent = function() {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'hideCallNotification'
            }, '*');
        }
    };
    
    // Function to unfold display screen on parent window
    window.unfoldDisplayScreenOnParent = function() {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'unfoldDisplayScreen'
            }, '*');
        }
    };

    // Listen for socket events
    if (typeof io !== 'undefined') {
        const socket = io();
        
        // Incoming call - show caller's information to receiver
        socket.on('incoming-call', function(data) {
            showCallNotification({
                type: 'incoming',
                name: data.callerName,
                counter: data.callerCounter || 'Unknown',
                service: data.callerService || 'Unknown Service'
            });
        });

        // Call ended/declined
        socket.on('call-ended', hideCallNotification);
        socket.on('call-declined', hideCallNotification);
        socket.on('call-failed', hideCallNotification);
    }
})();