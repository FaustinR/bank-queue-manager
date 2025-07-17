// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  
  if (req.xhr) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  res.redirect('/login');
};

// Admin role middleware
const isAdmin = (req, res, next) => {
  if (req.session && req.session.userRole === 'admin') {
    return next();
  }
  
  if (req.xhr) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  res.redirect('/display');
};

// Staff role middleware (admin or supervisor or employee)
const isStaff = (req, res, next) => {
  if (req.session && (req.session.userRole === 'admin' || req.session.userRole === 'supervisor' || req.session.userRole === 'employee')) {
    return next();
  }
  
  if (req.xhr) {
    return res.status(403).json({ message: 'Staff access required' });
  }
  
  res.redirect('/login');
};

module.exports = {
  isAuthenticated,
  isAdmin,
  isStaff
};