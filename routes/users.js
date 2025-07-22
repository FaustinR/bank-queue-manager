const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isAdmin, isAuthenticated } = require('../middleware/auth');

// Get all users (admin only)
router.get('/', isAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    
    // Make sure connected field is included in the response
    // If any user doesn't have the connected field, set it to 'no' by default
    users.forEach(user => {
      if (!user.connected) {
        user.connected = 'no';
      }
    });
    
    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get connected users (authenticated users only)
router.get('/connected', isAuthenticated, async (req, res) => {
  try {
    console.log('Fetching connected users...');
    
    // Debug: Check how many users have connected='yes'
    const connectedCount = await User.countDocuments({ connected: 'yes' });
    console.log(`Found ${connectedCount} users with connected='yes'`);
    
    // Always mark the current user as connected
    if (req.session.userId) {
      await User.findByIdAndUpdate(req.session.userId, { connected: 'yes' });
      console.log(`Updated current user ${req.session.userId} to connected='yes'`);
    }
    
    // Get all connected users
    const connectedUsers = await User.find({ connected: 'yes' })
      .select('_id firstName lastName email role counter')
      .sort({ firstName: 1 });
    
    // Include the current user's ID in the response
    const currentUserId = req.session.userId;
    console.log(`Current user ID: ${currentUserId}, Total connected users: ${connectedUsers.length}`);
    
    res.json({ connectedUsers, currentUserId });
  } catch (error) {
    console.error('Get connected users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark user as connected (authenticated users only)
router.post('/mark-connected', isAuthenticated, async (req, res) => {
  try {
    // Use the session user ID if no specific user ID is provided
    const userId = req.body.userId || req.session.userId;
    
    if (!userId) {
      return res.status(400).json({ message: 'No user ID provided' });
    }
    
    // Update user's connected status
    await User.findByIdAndUpdate(userId, { connected: 'yes' });
    console.log(`Marked user ${userId} as connected via API`);
    
    // Emit user connection event using Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('userConnectionUpdate', { userId, connected: 'yes' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Mark connected error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user by ID (admin only)
router.get('/:id', isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Middleware to check for full admin rights (not supervisor)
const isFullAdmin = (req, res, next) => {
  if (req.session && req.session.userRole === 'admin') {
    return next();
  }
  
  return res.status(403).json({ message: 'Full admin rights required for this operation' });
};

// Update user (admin only, not supervisor)
router.put('/:id', isAdmin, isFullAdmin, async (req, res) => {
  try {
    const { firstName, lastName, email, role } = req.body;
    
    // Check if email already exists for another user
    const existingUser = await User.findOne({ email, _id: { $ne: req.params.id } });
    
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use by another user' });
    }
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update user fields
    user.firstName = firstName;
    user.lastName = lastName;
    user.email = email;
    user.role = role;
    
    // Update password if provided
    if (req.body.password) {
      user.password = req.body.password;
    }
    
    await user.save();
    
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user (admin only, not supervisor)
router.delete('/:id', isAdmin, isFullAdmin, async (req, res) => {
  try {
    // Prevent deleting yourself
    if (req.session.userId === req.params.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    await User.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;