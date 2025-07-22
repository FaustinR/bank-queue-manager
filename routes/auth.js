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
    
    // Check if password exists
    if (!user.password) {
      return res.status(401).json({ message: 'User account is not properly set up. Please contact an administrator.' });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    // Counter is optional for all users
    
    // For admin users, counter is optional
    if (user.role === 'admin' && !counter) {
      // If admin doesn't select a counter, make sure any previous counter assignment is cleared
      if (user.counter) {
        const previousCounter = user.counter;
        user.counter = null;
        await user.save();
        
        // Clear Counter model assignment
        const Counter = require('../models/Counter');
        await Counter.updateOne(
          { counterId: parseInt(previousCounter), staffId: user._id },
          { $set: { staffId: null, staffName: null } }
        );
      }
    }
    
    // We'll keep the user's counter assignment in the database
    // and only manage it through the session to support multiple sessions
    
    // Assign counter to user if provided
    if (counter) {
      // Check if user is already logged in at a different counter
      if (user.sessions && user.sessions.size > 0) {
        // Get the first counter the user is assigned to
        const existingCounter = Array.from(user.sessions.values())[0];
        
        if (existingCounter && existingCounter !== counter) {
          return res.status(400).json({ 
            message: `You are already logged in at Counter ${existingCounter}. Please log out from that counter first or choose No counter.` 
          });
        }
      }
      
      // Check if counter is already occupied by a REAL staff member
      const Counter = require('../models/Counter');
      const occupiedCounter = await Counter.findOne({ 
        counterId: parseInt(counter), 
        staffId: { $ne: null, $ne: user._id },
        staffName: { $ne: null, $ne: "null", $ne: "undefined" }
      });
      
      if (occupiedCounter && occupiedCounter.staffName) {
        return res.status(400).json({ 
          message: `Counter ${counter} is already occupied by ${occupiedCounter.staffName}. Please select another counter.` 
        });
      }
      
      // Clear any invalid counter assignments before assigning this user
      await Counter.updateOne(
        { counterId: parseInt(counter) },
        { $set: { staffId: null, staffName: null } }
      );
      
      // Assign the counter to this session
      if (!req.session.id) {
        // Generate a session ID if it doesn't exist
        req.session.id = require('crypto').randomBytes(16).toString('hex');
      }
      
      // Store the counter in the user's sessions map
      if (!user.sessions) {
        user.sessions = new Map();
      }
      user.sessions.set(req.session.id, counter);
      await user.save();
      
      try {
        // Assign the user to the selected counter
        await Counter.findOneAndUpdate(
          { counterId: parseInt(counter) },
          { 
            staffId: user._id,
            staffName: `${user.firstName} ${user.lastName}`
          }
        );
      } catch (counterError) {
        // Error handling without logging
      }
      
      // Notify all clients about the counter staff update
      try {
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
          // Request completed
        });
        
        req.on('error', (error) => {
          // Error handling without logging
        });
        
        req.write(JSON.stringify({}));
        req.end();
      } catch (notifyError) {
        // Error handling without logging
      }
    }
    
    // Set session
    req.session.userId = user._id;
    req.session.userRole = user.role;
    
    // Set connected status to 'yes'
    user.connected = 'yes';
    await user.save();
    
    // Store the session ID
    if (!req.session.id) {
      req.session.id = require('crypto').randomBytes(16).toString('hex');
    }
    
    // Set the counter in the session
    if (counter) {
      req.session.userCounter = counter;
      // Also update the user's counter in the database for consistency across tabs
      user.counter = counter;
      await user.save();
    } else if (user.counter) {
      // If user has a counter in the database but none provided, use that
      req.session.userCounter = user.counter;
    } else {
      req.session.userCounter = null;
    }
    
    // Store server restart ID in session
    req.session.serverRestartId = global.SERVER_RESTART_ID;
    
    // Save session explicitly
    req.session.save();
    
    // Return user info (without password)
    const userResponse = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      counter: req.session.userCounter || user.counter,
      connected: user.connected || 'no'
    };
    
    res.json({ user: userResponse });
  } catch (error) {
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
    
    // Validate required fields
    if (!firstName || !lastName || !email || !password || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
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
      password, // Will be hashed by pre-save middleware
      role
    });
    
    await user.save();
    
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
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
    
    // If the session has a counter but the user doesn't, update the user's counter
    if (req.session.userCounter && !user.counter) {
      user.counter = req.session.userCounter;
      await user.save();
      
      // Also update the Counter model
      const Counter = require('../models/Counter');
      await Counter.findOneAndUpdate(
        { counterId: parseInt(req.session.userCounter) },
        { 
          staffId: user._id,
          staffName: `${user.firstName} ${user.lastName}`
        }
      );
    }
    // If the user has a counter but the session doesn't, update the session
    else if (user.counter && !req.session.userCounter) {
      req.session.userCounter = user.counter;
      req.session.save();
    }
    
    // Use the counter from the database as the source of truth
    const userCounter = user.counter;
    
    const userResponse = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      counter: userCounter,
      connected: user.connected || 'no'
    };
    
    res.json({ user: userResponse });
  } catch (error) {
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
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout route
router.get('/logout', async (req, res) => {
  try {
    // Get user information before destroying the session
    const userId = req.session.userId;
    const userCounter = req.session.userCounter;
    const sessionId = req.session.id;
    
    if (userId && sessionId) {
      // Get the user to update their sessions
      const user = await User.findById(userId);
      
      // Set connected status to 'no'
      if (user) {
        user.connected = 'no';
        await user.save();
      }
      
      if (user && user.sessions && user.sessions.has(sessionId)) {
        // Get the counter assigned to this session
        const sessionCounter = user.sessions.get(sessionId);
        
        // Remove this session from the user's sessions and set connected status to 'no'
        user.sessions.delete(sessionId);
        user.connected = 'no';
        await user.save();
        
        // Check if any other session is using this counter
        let counterInUse = false;
        for (const [otherSessionId, otherCounter] of user.sessions.entries()) {
          if (otherCounter === sessionCounter) {
            counterInUse = true;
            break;
          }
        }
        
        // Only clear the counter if no other session is using it
        if (!counterInUse && sessionCounter) {
          const Counter = require('../models/Counter');
          await Counter.findOneAndUpdate(
            { counterId: parseInt(sessionCounter), staffId: userId },
            { $set: { staffId: null, staffName: null } }
          );
          
          // Notify all clients about the staff logout for this counter
          try {
            const http = require('http');
            const options = {
              hostname: 'localhost',
              port: process.env.PORT || 3000,
              path: '/api/notify-staff-logout',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              }
            };
            
            const req = http.request(options, (res) => {
              // Request completed
            });
            
            req.on('error', (error) => {
              // Error handling without logging
            });
            
            req.write(JSON.stringify({ counterId: sessionCounter }));
            req.end();
          } catch (notifyError) {
            // Error handling without logging
          }
        }
      }
    }
    
    // Destroy the session
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Error logging out' });
      }
      
      res.redirect('/login?restart=true');
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during logout' });
  }
});

module.exports = router;