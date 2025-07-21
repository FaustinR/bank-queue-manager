// Authentication middleware
const isAuthenticated = async (req, res, next) => {
  if (req.session && req.session.userId) {
    // Counter is optional for all users
    // No need to check for counter assignment
    
    // Update the server restart ID in the session
    req.session.serverRestartId = global.SERVER_RESTART_ID;
    
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