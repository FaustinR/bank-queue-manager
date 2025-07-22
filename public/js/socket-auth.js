// Socket connection management
let socket;

// Initialize socket connection
function initializeSocket() {
  // Check if socket is already initialized
  if (socket && socket.connected) return;
  
  // Create socket connection
  socket = io();
  
  // Set up event listeners
  socket.on('connect', () => {
    console.log('Socket connected');
    
    // If user is logged in, authenticate the socket
    const userId = localStorage.getItem('userId');
    if (userId) {
      socket.emit('authenticate', userId);
    } else {
      // If userId is not in localStorage, try to get it from the server
      fetchCurrentUser();
    }
  });
  
  // Handle user connection updates
  socket.on('userConnectionUpdate', (data) => {
    // Update UI if needed based on user connection status
    console.log(`User ${data.userId} is now ${data.connected}`);
    
    // If we're on the users page, refresh the connected users list
    if (window.location.pathname === '/users' && typeof loadConnectedUsers === 'function') {
      loadConnectedUsers();
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });
}

// Fetch current user and authenticate socket
async function fetchCurrentUser() {
  try {
    console.log('Fetching current user...');
    const response = await fetch('/api/auth/me');
    const data = await response.json();
    
    if (response.ok && data.user && data.user._id) {
      console.log('Current user found:', data.user._id);
      // Authenticate socket with user ID
      authenticateSocket(data.user._id);
      
      // Also update the user's connected status directly
      try {
        await fetch('/api/users/mark-connected', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ userId: data.user._id })
        });
        console.log('User marked as connected via API');
      } catch (markError) {
        console.error('Error marking user as connected:', markError);
      }
    } else {
      console.log('No authenticated user found');
    }
  } catch (error) {
    console.error('Error fetching current user:', error);
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