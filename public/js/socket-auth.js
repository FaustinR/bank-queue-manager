// Socket connection management
let socket;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

// Initialize socket connection
function initializeSocket() {
  // Create socket connection with reconnection options
  socket = io({
    reconnection: true,
    reconnectionAttempts: maxReconnectAttempts,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
  });
  
  // Set up event listeners
  socket.on('connect', () => {
    reconnectAttempts = 0;
    // Always try to authenticate on connect/reconnect
    authenticateSocketFromSession();
  });
  
  socket.on('reconnect', () => {
    // Re-authenticate on reconnection
    authenticateSocketFromSession();
  });
  
  // Handle user connection updates
  socket.on('userConnectionUpdate', (data) => {
    // If we're on pages that show connected users, refresh the list
    if ((window.location.pathname === '/users' || window.location.pathname === '/connected-users' || window.location.pathname === '/admin') && typeof loadConnectedUsers === 'function') {
      loadConnectedUsers();
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', (reason) => {
    if (reason === 'io server disconnect') {
      // Server disconnected, try to reconnect
      socket.connect();
    }
  });
  
  socket.on('connect_error', (error) => {
    reconnectAttempts++;
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
    }
  });
}

// Authenticate socket using session data from server
async function authenticateSocketFromSession() {
  try {
    const response = await fetch('/api/auth/me');
    const data = await response.json();
    
    if (response.ok && data.user && data.user._id) {
      // Store user ID for future use
      localStorage.setItem('userId', data.user._id);
      
      // Authenticate socket with user ID
      if (socket && socket.connected) {
        socket.emit('authenticate', data.user._id);
      }
      
      // Mark user as connected
      try {
        await fetch('/api/users/mark-connected', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ userId: data.user._id })
        });
      } catch (markError) {
        // Error marking user as connected
      }
    } else {
      // User not authenticated, clear stored data
      localStorage.removeItem('userId');
    }
  } catch (error) {
    // Error fetching current user, clear stored data
    localStorage.removeItem('userId');
  }
}

// Call this function when user logs in
function authenticateSocket(userId) {
  if (!userId) return;
  
  if (socket && socket.connected) {
    socket.emit('authenticate', userId);
    
    // Store userId in localStorage for reconnection
    localStorage.setItem('userId', userId);
  } else {
    // If socket is not connected yet, store userId and initialize socket
    localStorage.setItem('userId', userId);
    initializeSocket();
  }
}

// Call this function when user logs out
function clearSocketAuthentication() {
  localStorage.removeItem('userId');
}

// Initialize socket when page loads
document.addEventListener('DOMContentLoaded', initializeSocket);

// Re-authenticate when page becomes visible (handles tab switching)
document.addEventListener('visibilitychange', function() {
  if (!document.hidden && socket && socket.connected) {
    // Page became visible, re-authenticate to ensure connection status is updated
    authenticateSocketFromSession();
  }
});

// Periodically refresh connection status (every 30 seconds)
setInterval(() => {
  if (socket && socket.connected) {
    authenticateSocketFromSession();
  }
}, 30000);