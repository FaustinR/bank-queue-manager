// Authentication middleware
const isAuthenticated = async (req, res, next) => {
  if (req.session && req.session.userId) {
    // Check if server has restarted since user's login
    if (!req.session.serverRestartId) {
      // No restart ID in session, this is from before we added this feature
      // Force logout for non-admin users
      if (req.session.userRole !== 'admin') {
        // Clear user's counter assignment
        try {
          const User = require('../models/User');
          const Counter = require('../models/Counter');
          
          // Get user's counter
          const user = await User.findById(req.session.userId);
          if (user && user.counter) {
            const counterId = user.counter;
            
            // Clear counter assignment
            user.counter = null;
            await user.save();
            
            // Clear counter in Counter model
            await Counter.updateOne(
              { counterId: parseInt(counterId) },
              { $set: { staffId: null, staffName: null } }
            );
          }
        } catch (error) {
          // Error handling without logging
        }
        
        // Destroy session
        req.session.destroy();
        
        if (req.xhr) {
          return res.status(401).json({ message: 'Session expired due to server restart' });
        }
        
        return res.redirect('/login?restart=true');
      }
    } else {
      // Get current server restart ID
      try {
        const http = require('http');
        const options = {
          hostname: 'localhost',
          port: process.env.PORT || 3000,
          path: '/api/server-restart-id',
          method: 'GET'
        };
        
        const serverRestartIdPromise = new Promise((resolve, reject) => {
          const req = http.request(options, (response) => {
            let data = '';
            
            response.on('data', (chunk) => {
              data += chunk;
            });
            
            response.on('end', () => {
              try {
                const parsedData = JSON.parse(data);
                resolve(parsedData.restartId);
              } catch (e) {
                reject(e);
              }
            });
          });
          
          req.on('error', (error) => {
            reject(error);
          });
          
          req.end();
        });
        
        const currentRestartId = await serverRestartIdPromise;
        
        // If server has restarted and user is not admin, force logout
        if (currentRestartId !== req.session.serverRestartId && req.session.userRole !== 'admin') {
          // Clear user's counter assignment
          try {
            const User = require('../models/User');
            const Counter = require('../models/Counter');
            
            // Get user's counter
            const user = await User.findById(req.session.userId);
            if (user && user.counter) {
              const counterId = user.counter;
              
              // Clear counter assignment
              user.counter = null;
              await user.save();
              
              // Clear counter in Counter model
              await Counter.updateOne(
                { counterId: parseInt(counterId) },
                { $set: { staffId: null, staffName: null } }
              );
            }
          } catch (error) {
            // Error handling without logging
          }
          
          // Destroy session
          req.session.destroy();
          
          if (req.xhr) {
            return res.status(401).json({ message: 'Session expired due to server restart' });
          }
          
          return res.redirect('/login?restart=true');
        }
      } catch (error) {
        // If we can't check the restart ID, continue anyway
      }
    }
    
    return next();
  }
  
  if (req.xhr) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  res.redirect('/login?restart=true');
};

// Admin role middleware
const isAdmin = (req, res, next) => {
  if (req.session && req.session.userRole) {
    // Set flags to indicate user role
    req.isSupervisor = req.session.userRole === 'supervisor';
    req.isEmployee = req.session.userRole === 'employee';
    return next();
  }
  
  if (req.xhr) {
    return res.status(403).json({ message: 'Authentication required' });
  }
  
  res.redirect('/login?restart=true');
};

// Staff role middleware (admin or supervisor or employee)
const isStaff = (req, res, next) => {
  if (req.session && (req.session.userRole === 'admin' || req.session.userRole === 'supervisor' || req.session.userRole === 'employee')) {
    return next();
  }
  
  if (req.xhr) {
    return res.status(403).json({ message: 'Staff access required' });
  }
  
  res.redirect('/login?restart=true');
};

module.exports = {
  isAuthenticated,
  isAdmin,
  isStaff
};