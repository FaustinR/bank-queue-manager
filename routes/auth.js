const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isAdmin } = require('../middleware/auth');

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password, counter } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    // Assign counter to user if provided and user is an employee
    console.log('Login: Counter provided:', counter, 'User role:', user.role);
    // Allow any role to select a counter for testing purposes
    if (counter) {
      console.log('Login: Assigning counter', counter, 'to user', user.email);
      user.counter = counter;
      await user.save();
      console.log('Login: User saved with counter:', user.counter);
      
      // Notify all clients about the counter staff update
      try {
        // Use node-fetch or axios for server-side fetch
        // This is a server-side request, so we need to use the full URL
        const http = require('http');
        const options = {
          hostname: 'localhost',
          port: process.env.PORT || 3000,
          path: '/api/notify-counter-update',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        };
        
        const req = http.request(options, (res) => {
          console.log('Counter staff update notification sent, status:', res.statusCode);
        });
        
        req.on('error', (error) => {
          console.error('Error notifying counter staff update:', error);
        });
        
        req.write(JSON.stringify({}));
        req.end();
      } catch (notifyError) {
        console.error('Error notifying counter staff update:', notifyError);
      }
    }
    
    // Set session
    req.session.userId = user._id;
    req.session.userRole = user.role;
    if (user.counter) {
      req.session.userCounter = user.counter;
    }
    
    // Return user info (without password)
    const userResponse = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      counter: user.counter
    };
    
    res.json({ user: userResponse });
  } catch (error) {
    console.error('Login error:', error);
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

// Signup route (admin only, not supervisor)
router.post('/signup', isAdmin, isFullAdmin, async (req, res) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }
    
    // Create new user
    const user = new User({
      firstName,
      lastName,
      email,
      password,
      role
    });
    
    await user.save();
    
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const user = await User.findById(req.session.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Return user info (without password)
    const userResponse = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      counter: user.counter
    };
    
    res.json({ user: userResponse });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const { firstName, lastName, password } = req.body;
    
    // Find user
    const user = await User.findById(req.session.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update user fields
    user.firstName = firstName;
    user.lastName = lastName;
    
    // Update password if provided
    if (password) {
      user.password = password;
    }
    
    await user.save();
    
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout route
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Error logging out' });
    }
    
    res.redirect('/login');
  });
});

module.exports = router;