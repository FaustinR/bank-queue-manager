const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const dotenv = require('dotenv');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const connectDB = require('./config/db');
const Ticket = require('./models/Ticket');
const Counter = require('./models/Counter');
const User = require('./models/User');
const Call = require('./models/Call');
const Message = require('./models/Message');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const { isAuthenticated, isAdmin, isStaff } = require('./middleware/auth');

// Middleware to mark authenticated users as connected
const markUserConnected = async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      await User.findByIdAndUpdate(req.session.userId, { connected: 'yes' });
      // Emit user connection update
      const io = req.app.get('io');
      if (io) {
        io.emit('userConnectionUpdate', { userId: req.session.userId, connected: 'yes' });
      }
    } catch (error) {
      // Continue even if update fails
    }
  }
  next();
};



// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

// Server restart flag - changes on each restart
global.SERVER_RESTART_ID = Date.now().toString();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Make io available to routes
app.set('io', io);

app.use(express.static('public'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Session middleware
const sessionStore = MongoStore.create({ 
  mongoUrl: process.env.MONGO_URI || 'mongodb://localhost:27017/bankQueue',
  ttl: 14 * 24 * 60 * 60, // 14 days
  autoRemove: 'interval',
  autoRemoveInterval: 10 // Check expired sessions every 10 minutes
});

// Handle session expiration
sessionStore.on('expired', async function(sessionId) {
  try {
    // Find user with this session and clear their counter assignment
    const sessionData = await sessionStore.get(sessionId);
    if (sessionData && sessionData.userId) {
      // Clear counter assignment and set connected status to 'no' in User model
      await User.findByIdAndUpdate(sessionData.userId, { counter: null, connected: 'no' });
      
      if (sessionData.userCounter) {
        // Clear counter assignment in Counter model
        await Counter.findOneAndUpdate(
          { counterId: parseInt(sessionData.userCounter) },
          { $set: { staffId: null, staffName: null } }
        );
        
        // Notify clients about the staff logout
        io.emit('staffLogout', { counterId: sessionData.userCounter });
        
        // Update counter staff information with IDs
        const staffInfo = await getCounterStaffInfo();
        
        // Create a deep copy of the queues to avoid reference issues
        const queuesCopy = {};
        Object.keys(queues).forEach(key => {
          queuesCopy[key] = [...queues[key]];
        });
        
        io.emit('queueUpdate', { 
          queues: queuesCopy, 
          counters, 
          counterStaff: staffInfo.counterStaff,
          counterStaffIds: staffInfo.counterStaffIds
        });
      }
    }
  } catch (error) {
    // Error handling without logging
  }
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'bank-queue-secret',
  resave: true,
  saveUninitialized: true,
  store: sessionStore,
  cookie: {
    maxAge: 14 * 24 * 60 * 60 * 1000 // 14 days in milliseconds
  }
}));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

// Services and their dedicated counters
const services = {
  'Account Opening': 1,
  'Loan Application': 2,
  'Money Transfer': 3,
  'Card Services': 4,
  'General Inquiry': 5
  // Other custom services will be handled dynamically
};

// In-memory queue management (will be synced with MongoDB)
let queues = {
  1: [], // Account Opening
  2: [], // Loan Application
  3: [], // Money Transfer
  4: [], // Card Services
  5: []  // General Inquiry
};

// Global ticket counter (will be initialized from MongoDB)
let ticketCounter = 0;

// In-memory counter status (will be synced with MongoDB)
let counters = {
  1: { name: 'Account Opening', current: null, status: 'available', service: 'Account Opening' },
  2: { name: 'Loan Application', current: null, status: 'available', service: 'Loan Application' },
  3: { name: 'Money Transfer', current: null, status: 'available', service: 'Money Transfer' },
  4: { name: 'Card Services', current: null, status: 'available', service: 'Card Services' },
  5: { name: 'General Inquiry', current: null, status: 'available', service: 'General Inquiry' }
};

// Initialize data from MongoDB
async function initializeFromDB() {
  try {
    // Get the latest ticket number
    const latestTicket = await Ticket.findOne().sort({ ticketNumber: -1 });
    if (latestTicket) {
      ticketCounter = latestTicket.ticketNumber;
    } else {
      ticketCounter = 0; // Will be incremented to 1 when first ticket is created
    }
    
    // Clear existing queues first to prevent duplicates
    Object.keys(queues).forEach(key => {
      queues[key] = [];
    });
    
    // Get waiting tickets and populate queues (latest first)
    const waitingTickets = await Ticket.find({ status: 'waiting' }).sort({ createdAt: -1 });
    waitingTickets.forEach(ticket => {
      if (queues[ticket.counterId]) {
        queues[ticket.counterId].push({
          id: ticket._id,
          number: ticket.ticketNumber,
          customerName: ticket.customerName,
          service: ticket.service,
          language: ticket.language,
          counterId: ticket.counterId,
          timestamp: ticket.createdAt,
          status: ticket.status
        });
      }
    });
    
    // Get counter status
    const dbCounters = await Counter.find().populate('currentTicket');
    dbCounters.forEach(counter => {
      if (counters[counter.counterId]) {
        // If there's a current ticket being served, set status to serving
        if (counter.currentTicket && counter.currentTicket.status === 'serving') {
          counters[counter.counterId].status = 'serving';
          counters[counter.counterId].current = {
            id: counter.currentTicket._id,
            number: counter.currentTicket.ticketNumber,
            customerName: counter.currentTicket.customerName,
            service: counter.currentTicket.service,
            language: counter.currentTicket.language,
            counterId: counter.currentTicket.counterId,
            timestamp: counter.currentTicket.createdAt,
            status: counter.currentTicket.status
          };
        } else {
          // No current ticket or ticket not being served, set to available
          counters[counter.counterId].status = 'available';
          counters[counter.counterId].current = null;
        }
      }
    });
    
    // Log out all non-admin users on application restart
    // This ensures employees have to select a counter when logging in again
    await logoutNonAdminUsers();
    
    // Sync counter staff information from User model to Counter model
    const usersWithCounters = await User.find({ counter: { $ne: null } })
      .select('_id firstName lastName counter');
    
    for (const user of usersWithCounters) {
      const counterId = parseInt(user.counter);
      await Counter.findOneAndUpdate(
        { counterId },
        { 
          staffId: user._id,
          staffName: `${user.firstName} ${user.lastName}`
        }
      );
    }
  } catch (error) {
    // Error handling without logging
  }
}

// Initialize data when server starts
initializeFromDB();

// Public routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'kiosk.html'));
});

app.get('/ticket', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ticket.html'));
});

// Authentication routes
app.get('/login', (req, res) => {
  // If already logged in, redirect to admin dashboard
  if (req.session.userId) {
    return res.redirect('/admin');
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Staff routes
// Display and history pages are public
app.get('/display', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'display.html'));
});

// Counter pages require authentication
app.get('/counter/:id', isAuthenticated, markUserConnected, (req, res) => {
  // Check if this is an embedded request (from display screen)
  const isEmbedded = req.query.embedded === 'true' || req.headers.referer?.includes('/display');
  
  if (isEmbedded) {
    res.sendFile(path.join(__dirname, 'public', 'counter-embedded.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'counter.html'));
  }
});

// History page is public
app.get('/history', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'history.html'));
});

// Middleware to check for full admin rights (admin only)
const isFullAdmin = (req, res, next) => {
  if (req.session && req.session.userRole === 'admin') {
    return next();
  }
  
  return res.redirect('/admin');
};

// Middleware to check for admin or supervisor (not employee)
const isAdminOrSupervisor = (req, res, next) => {
  if (req.session && (req.session.userRole === 'admin' || req.session.userRole === 'supervisor')) {
    return next();
  }
  
  return res.redirect('/admin');
};

// Admin routes
app.get('/admin', isAdmin, markUserConnected, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/signup', isAdmin, isFullAdmin, markUserConnected, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/users', isAdmin, markUserConnected, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'users.html'));
});

app.get('/edit-user/:id', isAdmin, isFullAdmin, markUserConnected, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'edit-user.html'));
});

app.get('/profile', isAuthenticated, markUserConnected, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/inbox', isAuthenticated, markUserConnected, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'inbox.html'));
});

app.get('/call-logs', isAuthenticated, markUserConnected, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'call-logs.html'));
});

app.get('/connected-users', isAuthenticated, markUserConnected, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'connected-users.html'));
});

// API endpoint to get call logs
app.get('/api/call-logs', isAuthenticated, async (req, res) => {
  try {
    const calls = await Call.find({
      $or: [
        { callerId: req.session.userId },
        { recipientId: req.session.userId }
      ]
    })
    .populate('callerId', 'firstName lastName')
    .populate('recipientId', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(100);
    
    res.json({ calls });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to delete call logs
app.delete('/api/call-logs/:id', isAuthenticated, async (req, res) => {
  try {
    await Call.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/call-logs', isAuthenticated, async (req, res) => {
  try {
    const { ids } = req.body;
    await Call.deleteMany({ _id: { $in: ids } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Voice note endpoint (base64 audio data)
app.post('/api/messages/voice-note', async (req, res) => {
  try {
    const { tellerId, tellerName, counterId, audioData } = req.body;
    
    if (!audioData) {
      return res.status(400).send('No voice note data provided');
    }
    
    // Get sender info from session
    if (!req.session || !req.session.userId) {
      return res.status(401).send('Authentication required');
    }
    
    const sender = await User.findById(req.session.userId);
    if (!sender) {
      return res.status(401).send('User not found');
    }
    
    const senderName = `${sender.firstName} ${sender.lastName}`;
    
    // Create message with voice note data
    const messageData = {
      tellerId,
      senderEmail: sender.email,
      senderName,
      subject: `Voice Note from Display Screen - Counter ${counterId}`,
      content: '[Voice Note]',
      voiceNoteData: audioData,
      messageType: 'voice-note'
    };
    
    // Create message directly
    const recipient = await User.findById(tellerId);
    if (!recipient) {
      return res.status(404).send('Recipient not found');
    }
    
    const newMessage = new Message({
      sender: sender._id,
      recipient: tellerId,
      subject: messageData.subject,
      content: messageData.content,
      messageType: 'voice-note',
      voiceNoteData: audioData
    });
    
    await newMessage.save();
    
    // Emit socket notification
    const io = req.app.get('io');
    if (io) {
      io.emit('newMessage', { 
        recipientId: tellerId, 
        messageId: newMessage._id,
        subject: messageData.subject,
        senderName: senderName
      });
    }
    
    res.json({ success: true, message: 'Voice note sent successfully' });
    
  } catch (error) {
    res.status(500).send('Server error: ' + error.message);
  }
});



// No debug pages

// API endpoints
app.post('/api/ticket', async (req, res) => {
  try {
    const { customerName, service, language } = req.body;
    
    if (!customerName || !service || !language) {
      return res.status(400).json({ error: 'Name, service, and language are required' });
    }
    
    // Get counter ID for the service, or use General Inquiry counter (5) for custom services
    let counterId = services[service];
    let serviceToUse = service;
    let customService = null;
    
    // Handle custom services
    if (!counterId) {
      // Always assign custom services to General Inquiry counter
      counterId = 5;
      customService = service;
    }
    
    // Check if database is empty and reset counter if needed
    const ticketCount = await Ticket.countDocuments();
    if (ticketCount === 0) {
      ticketCounter = 0;
    }
    
    // Increment global ticket counter
    ticketCounter++;
    
    // Create ticket in MongoDB
    const newTicket = new Ticket({
      ticketNumber: ticketCounter,
      customerName,
      service: serviceToUse,
      language,
      counterId,
      status: 'waiting',
      customService
    });
    
    await newTicket.save();
    
    const ticket = {
      id: newTicket._id,
      number: ticketCounter,
      customerName,
      service: serviceToUse,
      language,
      counterId,
      timestamp: newTicket.createdAt,
      status: 'waiting'
    };
    
    queues[counterId].push(ticket);
    
    // Get counter staff information with IDs
    const staffInfo = await getCounterStaffInfo();
    
    // Create a deep copy of the queues to avoid reference issues
    const queuesCopy = {};
    Object.keys(queues).forEach(key => {
      queuesCopy[key] = [...queues[key]];
    });
    
    // Broadcast to all displays
    io.emit('queueUpdate', { 
      queues: queuesCopy, 
      counters, 
      counterStaff: staffInfo.counterStaff,
      counterStaffIds: staffInfo.counterStaffIds
    });
    
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public API endpoint for queue data
app.get('/api/queue', async (req, res) => {
  try {
    // Check if database is empty and reset counter if needed
    const ticketCount = await Ticket.countDocuments();
    if (ticketCount === 0) {
      ticketCounter = 0;
    }
    
    // Get fresh data from MongoDB - this will clear and repopulate queues
    await initializeFromDB();
    
    // Get counter staff information with IDs
    const staffInfo = await getCounterStaffInfo();
    
    // Create a deep copy of the queues to avoid reference issues
    const queuesCopy = {};
    Object.keys(queues).forEach(key => {
      queuesCopy[key] = [...queues[key]];
    });
    
    res.json({ 
      queues: queuesCopy, 
      counters, 
      counterStaff: staffInfo.counterStaff,
      counterStaffIds: staffInfo.counterStaffIds
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint to check connected sockets
app.get('/api/debug/sockets', (req, res) => {
  const sockets = Array.from(io.sockets.sockets.values()).map(s => ({
    id: s.id,
    userId: s.userId,
    connected: s.connected
  }));
  res.json({ sockets, count: sockets.length });
});





// Endpoint to manually refresh counter staff information
app.get('/api/refresh-counters', async (req, res) => {
  try {
    // Get updated counter staff information
    const staffInfo = await getCounterStaffInfo();
    
    // Create a deep copy of the queues to avoid reference issues
    const queuesCopy = {};
    Object.keys(queues).forEach(key => {
      queuesCopy[key] = [...queues[key]];
    });
    
    // Emit update to all clients
    io.emit('queueUpdate', { 
      queues: queuesCopy, 
      counters, 
      counterStaff: staffInfo.counterStaff,
      counterStaffIds: staffInfo.counterStaffIds
    });
    
    res.json({ success: true, counterStaff: staffInfo.counterStaff });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// No longer needed - server restart ID is accessed directly via global variable

// API endpoint to get counter staff information
app.get('/api/counters/staff', async (req, res) => {
  try {
    // Get counter staff information with IDs
    const staffInfo = await getCounterStaffInfo();
    
    // Return the staff maps
    res.json(staffInfo);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to get current user information
app.get('/api/user/current', async (req, res) => {
  try {
    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId).select('firstName lastName email');
      if (user) {
        res.json({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`
        });
      } else {
        res.json({ email: '', name: '' });
      }
    } else {
      res.json({ email: '', name: '' });
    }
  } catch (error) {
    res.json({ email: '', name: '' });
  }
});

// API endpoint to check if a counter is occupied
app.get('/api/counters/:id/check', async (req, res) => {
  try {
    const counterId = req.params.id;
    
    // First, clear any invalid counter assignments
    const invalidCounter = await Counter.findOne({
      counterId: parseInt(counterId),
      $or: [
        { staffId: null, staffName: { $ne: null } },  // staffName without staffId
        { staffId: { $ne: null }, staffName: null },   // staffId without staffName
        { staffId: { $ne: null }, staffName: "null" }, // staffId with "null" staffName
        { staffId: { $ne: null }, staffName: "undefined" } // staffId with "undefined" staffName
      ]
    });
    
    if (invalidCounter) {
      // Auto-clear invalid assignments
      await Counter.updateOne(
        { counterId: parseInt(counterId) },
        { $set: { staffId: null, staffName: null } }
      );
      
      // Also clear any user assignments to this counter and set connected status to 'no'
      await User.updateMany(
        { counter: counterId.toString() },
        { $set: { counter: null, connected: 'no' } }
      );
      
      // Return not occupied since we just cleared it
      return res.json({ occupied: false });
    }
    
    // Now check if counter has a valid staff assignment
    const counter = await Counter.findOne({ 
      counterId: parseInt(counterId), 
      staffId: { $ne: null },
      staffName: { $ne: null, $ne: "null", $ne: "undefined" }
    });
    
    if (counter && counter.staffName) {
      return res.json({ occupied: true, staffName: counter.staffName });
    }
    
    // As a fallback, check User model for valid users
    const user = await User.findOne({ 
      counter: counterId,
      firstName: { $ne: null },
      lastName: { $ne: null }
    });
    
    if (user && user.firstName && user.lastName) {
      // Update the counter with the user's information
      await Counter.updateOne(
        { counterId: parseInt(counterId) },
        { 
          $set: { 
            staffId: user._id,
            staffName: `${user.firstName} ${user.lastName}`
          } 
        }
      );
      
      return res.json({ 
        occupied: true, 
        staffName: `${user.firstName} ${user.lastName}` 
      });
    }
    
    // Counter is not occupied
    res.json({ occupied: false });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to clear orphaned counter assignments
app.post('/api/counters/:id/clear', async (req, res) => {
  try {
    const counterId = req.params.id;
    
    // Clear counter assignment in Counter model
    await Counter.updateOne(
      { counterId: parseInt(counterId) },
      { $set: { staffId: null, staffName: null } }
    );
    
    // Clear counter assignment in User model
    await User.updateMany(
      { counter: counterId.toString() },
      { $set: { counter: null } }
    );
    
    // Emit staff logout event
    io.emit('staffLogout', { counterId });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/counter/:id/next', async (req, res) => {
  const counterId = parseInt(req.params.id);
  
  try {
    if (queues[counterId] && queues[counterId].length > 0) {
      const nextCustomer = queues[counterId].shift();
      counters[counterId].current = nextCustomer;
      counters[counterId].status = 'serving';
      
      // Get current teller information
      const staffInfo = await getCounterStaffInfo();
      const tellerName = staffInfo.counterStaff[counterId] || null;
      
      // Update ticket in MongoDB
      const ticket = await Ticket.findById(nextCustomer.id);
      if (ticket) {
        ticket.status = 'serving';
        ticket.calledAt = new Date();
        ticket.tellerName = tellerName; // Store teller name
        await ticket.save();
        
        // Update counter in MongoDB
        await Counter.findOneAndUpdate(
          { counterId },
          { 
            status: 'serving',
            currentTicket: ticket._id
          }
        );
      }
      
      // Create a deep copy of the queues to avoid reference issues
      const queuesCopy = {};
      Object.keys(queues).forEach(key => {
        queuesCopy[key] = [...queues[key]];
      });
      
      io.emit('queueUpdate', { 
        queues: queuesCopy, 
        counters, 
        counterStaff: staffInfo.counterStaff,
        counterStaffIds: staffInfo.counterStaffIds
      });
      io.emit('customerCalled', { 
        customer: nextCustomer, 
        counter: counterId,
        counterName: counters[counterId].name
      });
      
      res.json({ success: true, customer: nextCustomer });
    } else {
      res.json({ success: false, message: 'No customers in queue for this service' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/counter/:id/complete', async (req, res) => {
  const counterId = parseInt(req.params.id);
  
  try {
    // Get the current ticket being served
    const currentTicket = counters[counterId].current;
    
    if (currentTicket && currentTicket.id) {
      // Update ticket in MongoDB
      const ticket = await Ticket.findById(currentTicket.id);
      if (ticket) {
        ticket.status = 'completed';
        const completedAt = new Date();
        ticket.completedAt = completedAt;
        
        // Calculate service time if calledAt exists
        if (ticket.calledAt) {
          const calledAt = new Date(ticket.calledAt);
          const serviceTimeMs = completedAt - calledAt;
          ticket.serviceTime = Math.round(serviceTimeMs / 60000); // Convert to minutes
        }
        
        await ticket.save();
        
        // Emit a specific event for ticket updates
        io.emit('ticketUpdated', { ticket });
      }
    }
    
    // Update counter in MongoDB
    await Counter.findOneAndUpdate(
      { counterId },
      { 
        status: 'available',
        currentTicket: null,
        $inc: { totalServed: 1 }
      }
    );
    
    counters[counterId].current = null;
    counters[counterId].status = 'available';
    
    // Get counter staff information with IDs
    const staffInfo = await getCounterStaffInfo();
    
    // Create a deep copy of the queues to avoid reference issues
    const queuesCopy = {};
    Object.keys(queues).forEach(key => {
      queuesCopy[key] = [...queues[key]];
    });
    
    io.emit('queueUpdate', { 
      queues: queuesCopy, 
      counters, 
      counterStaff: staffInfo.counterStaff,
      counterStaffIds: staffInfo.counterStaffIds
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Function to get counter staff information
async function getCounterStaffInfo() {
  try {
    // First, get all users with assigned counters (including admins)
    const usersWithCounters = await User.find({ counter: { $ne: null } })
      .select('_id firstName lastName counter role connected');
    
    // Create maps of counter ID to staff name and staff ID
    const staffMap = {};
    const staffIdMap = {};
    
    // Process all users with counter assignments
    for (const user of usersWithCounters) {
      const counterId = user.counter.toString();
      const fullName = `${user.firstName} ${user.lastName}`;
      
      // Add to staff maps
      staffMap[counterId] = fullName;
      staffIdMap[counterId] = user._id.toString();
      
      // Update the Counter model to ensure it's in sync
      await Counter.findOneAndUpdate(
        { counterId: parseInt(counterId) },
        { 
          staffId: user._id,
          staffName: fullName
        },
        { upsert: true }
      );
    }
    
    return { counterStaff: staffMap, counterStaffIds: staffIdMap };
  } catch (error) {
    return { counterStaff: {}, counterStaffIds: {} };
  }
}

// Socket.io connection
io.on('connection', async (socket) => {

  
  // Get counter staff information with IDs
  const staffInfo = await getCounterStaffInfo();
  
  // Create a deep copy of the queues to avoid reference issues
  const queuesCopy = {};
  Object.keys(queues).forEach(key => {
    queuesCopy[key] = [...queues[key]];
  });
  
  // Send current state to new client
  socket.emit('queueUpdate', { 
    queues: queuesCopy, 
    counters, 
    counterStaff: staffInfo.counterStaff,
    counterStaffIds: staffInfo.counterStaffIds
  });
  
  // Handle authentication with improved error handling
  socket.on('authenticate', async (userId) => {
    if (userId) {
      socket.userId = userId.toString();
      socket.isAuthenticated = true;
      console.log('=== SOCKET AUTHENTICATED ===');
      console.log('Socket:', socket.id, 'User:', socket.userId);
      
      try {
        // Verify user exists before updating
        const user = await User.findById(userId);
        if (user) {
          await User.findByIdAndUpdate(userId, { connected: 'yes' }, { new: true });
          console.log('User connected:', `${user.firstName} ${user.lastName}`);
          socket.emit('authenticated', { userId: socket.userId });
          
          // Broadcast user connection update
          io.emit('userConnectionUpdate', { userId: socket.userId, connected: 'yes' });
        } else {
          console.log('User not found for authentication:', userId);
          socket.emit('authentication-failed', { reason: 'User not found' });
        }
      } catch (error) {
        console.error('Authentication error:', error);
        socket.emit('authentication-failed', { reason: 'Authentication failed' });
      }
    } else {
      console.log('No userId provided for authentication');
      socket.emit('authentication-failed', { reason: 'No user ID provided' });
    }
  });
  

  
  // Voice call handlers
  socket.on('call-user', async (data) => {
    try {
      console.log('=== CALL ATTEMPT ===');
      console.log('From socket:', socket.id, 'userId:', socket.userId);
      console.log('To user:', data.recipientId);
      
      if (!socket.userId || !socket.isAuthenticated) {
        console.log('Caller not authenticated');
        return socket.emit('call-failed', { reason: 'You must be logged in to make calls' });
      }
      
      const targetUser = await User.findById(data.recipientId).select('firstName lastName connected');
      
      if (!targetUser) {
        console.log('Target user not found in database');
        return socket.emit('call-failed', { reason: 'User not found' });
      }
      
      console.log('Target user:', targetUser.firstName, targetUser.lastName, 'Connected:', targetUser.connected);
      
      // Double-check user connection by looking for active sockets
      const userSockets = Array.from(io.sockets.sockets.values())
        .filter(s => String(s.userId) === String(data.recipientId) && s.isAuthenticated);
      
      if (targetUser.connected !== 'yes' && userSockets.length === 0) {
        console.log('Target user not connected - DB status:', targetUser.connected, 'Active sockets:', userSockets.length);
        return socket.emit('call-failed', { reason: `${targetUser.firstName} ${targetUser.lastName} is not connected` });
      }
      
      // If DB says not connected but we have active sockets, update DB
      if (targetUser.connected !== 'yes' && userSockets.length > 0) {
        console.log('Updating user connection status in DB');
        await User.findByIdAndUpdate(data.recipientId, { connected: 'yes' });
      }
      
      // Find all authenticated sockets for the target user
      const allSockets = Array.from(io.sockets.sockets.values());
      const targetSockets = allSockets.filter(s => 
        String(s.userId) === String(data.recipientId) && 
        s.isAuthenticated && 
        s.connected
      );
      
      console.log('=== TARGET SOCKETS FOUND ===');
      console.log('Count:', targetSockets.length);
      targetSockets.forEach(s => {
        console.log(`Socket ${s.id}: userId=${s.userId}, auth=${s.isAuthenticated}, connected=${s.connected}`);
      });
      
      if (targetSockets.length > 0) {
        console.log('=== SENDING CALL TO ALL TARGET SOCKETS ===');
        
        // Get caller's counter and service information
        const caller = await User.findById(socket.userId).select('counter');
        let callerCounter = 'Unknown';
        let callerService = 'Unknown Service';
        
        if (caller && caller.counter) {
          callerCounter = caller.counter;
          const counterInfo = counters[parseInt(caller.counter)];
          if (counterInfo) {
            callerService = counterInfo.service;
          }
        }
        
        // Get recipient's counter and service information
        const recipient = await User.findById(data.recipientId).select('counter');
        let recipientCounter = 'Unknown';
        let recipientService = 'Unknown Service';
        
        if (recipient && recipient.counter) {
          recipientCounter = recipient.counter;
          const counterInfo = counters[parseInt(recipient.counter)];
          if (counterInfo) {
            recipientService = counterInfo.service;
          }
        }
        
        const callData = {
          callerId: socket.userId,
          callerName: data.callerName,
          callerEmail: data.callerEmail,
          callerCounter: callerCounter,
          callerService: callerService,
          recipientCounter: recipientCounter,
          recipientService: recipientService,
          offer: data.offer
        };
        
        // Create single call record
        const newCall = new Call({
          callerId: socket.userId,
          recipientId: data.recipientId,
          callerName: data.callerName,
          recipientName: `${targetUser.firstName} ${targetUser.lastName}`,
          type: 'outgoing',
          status: 'initiated'
        });
        await newCall.save();
        
        callData.callId = newCall._id;
        
        // Send to all authenticated sockets of the target user
        targetSockets.forEach(targetSocket => {
          console.log('Sending to socket:', targetSocket.id);
          targetSocket.emit('incoming-call', callData);
        });
        
        console.log('incoming-call events sent to', targetSockets.length, 'sockets');
      } else {
        console.log('=== NO TARGET SOCKETS AVAILABLE ===');
        console.log('Looking for userId:', data.recipientId);
        socket.emit('call-failed', { reason: `${targetUser.firstName} ${targetUser.lastName} is not available for calls right now` });
      }
    } catch (error) {
      console.error('Call handler error:', error);
      socket.emit('call-failed', { reason: 'Call failed - please try again' });
    }
  });
  
  socket.on('answer-call', async (data) => {
    try {
      // Update call record to answered with start time
      await Call.updateOne(
        { 
          $or: [
            { callerId: socket.userId, recipientId: data.callerId },
            { callerId: data.callerId, recipientId: socket.userId }
          ],
          status: 'initiated'
        },
        { 
          status: 'answered',
          startTime: new Date()
        }
      );
    } catch (error) {
      console.error('Error updating call status:', error);
    }
    
    const targetSockets = Array.from(io.sockets.sockets.values())
      .filter(s => String(s.userId) === String(data.callerId) && s.isAuthenticated && s.connected);
    
    targetSockets.forEach(targetSocket => {
      targetSocket.emit('call-answered', { answer: data.answer });
    });
  });
  
  socket.on('ice-candidate', (data) => {
    const targetSockets = Array.from(io.sockets.sockets.values())
      .filter(s => String(s.userId) === String(data.targetId) && s.isAuthenticated && s.connected);
    
    targetSockets.forEach(targetSocket => {
      targetSocket.emit('ice-candidate', data.candidate);
    });
  });
  
  socket.on('end-call', async (data) => {
    console.log('=== CALL END REQUEST ===');
    console.log('From socket:', socket.id, 'userId:', socket.userId);
    console.log('Target user:', data.targetId);
    
    // Update call record with end time and duration
    try {
      const call = await Call.findOne({
        $or: [
          { callerId: socket.userId, recipientId: data.targetId },
          { callerId: data.targetId, recipientId: socket.userId }
        ],
        status: { $in: ['answered', 'initiated'] }
      }).sort({ createdAt: -1 });
      
      if (call) {
        const endTime = new Date();
        let duration = 0;
        
        // Only calculate duration if call was answered (has startTime)
        if (call.startTime && call.status === 'answered') {
          duration = Math.floor((endTime - call.startTime) / 1000); // in seconds
        }
        
        await Call.updateOne(
          { _id: call._id },
          { 
            status: 'ended',
            endTime: endTime,
            duration: Math.max(0, duration)
          }
        );
      }
    } catch (error) {
      console.error('Error updating call duration:', error);
    }
    
    // Send call-ended to target user
    const targetSockets = Array.from(io.sockets.sockets.values())
      .filter(s => String(s.userId) === String(data.targetId) && s.isAuthenticated && s.connected);
    
    console.log('Target sockets found:', targetSockets.length);
    targetSockets.forEach(targetSocket => {
      console.log('Sending call-ended to target socket:', targetSocket.id);
      targetSocket.emit('call-ended');
    });
    
    // Also emit to the caller to confirm call ended
    console.log('Confirming call-ended to caller');
    socket.emit('call-ended');
  });
  
  socket.on('call-declined', async (data) => {
    try {
      // Update call record to declined/missed
      await Call.updateOne(
        { 
          $or: [
            { callerId: socket.userId, recipientId: data.callerId },
            { callerId: data.callerId, recipientId: socket.userId }
          ],
          status: 'initiated'
        },
        { status: 'declined' }
      );
    } catch (error) {
      console.error('Error updating call status:', error);
    }
    
    const targetSockets = Array.from(io.sockets.sockets.values())
      .filter(s => String(s.userId) === String(data.callerId) && s.isAuthenticated && s.connected);
    
    targetSockets.forEach(targetSocket => {
      targetSocket.emit('call-declined');
    });
  });
  
  socket.on('disconnect', async () => {
    // If socket had a userId, update the user's connected status
    if (socket.userId) {
      // Check if user has other active connections before marking as disconnected
      const connectedSockets = Array.from(io.sockets.sockets.values())
        .filter(s => s.userId === socket.userId && s.id !== socket.id);
      
      // Only mark as disconnected if this was the last connection for this user
      if (connectedSockets.length === 0) {
        // Notify any ongoing calls that this user disconnected
        socket.broadcast.emit('call-ended-disconnect', { userId: socket.userId });
        
        await User.findByIdAndUpdate(socket.userId, { connected: 'no' });
        
        // Emit user disconnection event
        io.emit('userConnectionUpdate', { userId: socket.userId, connected: 'no' });
      }
    }
  });
});

// Emit counter staff update when a user logs in with a counter
app.post('/api/notify-counter-update', async (req, res) => {
  // Mark the current user as connected immediately
  if (req.session && req.session.userId) {
    console.log('Marking user as connected via counter update:', req.session.userId);
    const result = await User.findByIdAndUpdate(req.session.userId, { connected: 'yes' });
    console.log('Counter update - user marked as connected:', !!result);
    
    // Emit user connection event
    io.emit('userConnectionUpdate', { userId: req.session.userId, connected: 'yes' });
  }
  
  // Get updated counter staff information with IDs
  const staffInfo = await getCounterStaffInfo();
  
  // Create a deep copy of the queues to avoid reference issues
  const queuesCopy = {};
  Object.keys(queues).forEach(key => {
    queuesCopy[key] = [...queues[key]];
  });
  
  // Emit update to all clients with the counter staff information
  io.emit('queueUpdate', { 
    queues: queuesCopy, 
    counters, 
    counterStaff: staffInfo.counterStaff,
    counterStaffIds: staffInfo.counterStaffIds
  });
  
  res.json({ success: true });
});

// Emit staff logout event when a user logs out
app.post('/api/notify-staff-logout', async (req, res) => {
  const { counterId } = req.body;
  
  if (counterId) {
    // Double-check that the counter is actually cleared in both models
    const counterIdInt = parseInt(counterId);
    
    // Clear in Counter model
    await Counter.updateOne(
      { counterId: counterIdInt },
      { $set: { staffId: null, staffName: null } }
    );
    
    // Clear in User model
    await User.updateMany(
      { counter: counterId.toString() },
      { $set: { counter: null } }
    );
    
    // Emit staff logout event to all clients
    io.emit('staffLogout', { counterId });
    
    // Force refresh of in-memory data
    await initializeFromDB();
  }
  
  // Get updated counter staff information with IDs
  const staffInfo = await getCounterStaffInfo();
  
  // Create a deep copy of the queues to avoid reference issues
  const queuesCopy = {};
  Object.keys(queues).forEach(key => {
    queuesCopy[key] = [...queues[key]];
  });
  
  // Emit update to all clients with the counter staff information
  io.emit('queueUpdate', { 
    queues: queuesCopy, 
    counters, 
    counterStaff: staffInfo.counterStaff,
    counterStaffIds: staffInfo.counterStaffIds
  });
  
  res.json({ success: true });
});

// API endpoint to clear counter assignment when browser tab is closed
app.post('/api/clear-counter-assignment', async (req, res) => {
  try {
    // Check if this is a page refresh
    const isRefresh = req.headers['x-is-refresh'] === 'true';
    
    // If it's a refresh, don't clear the counter
    if (isRefresh) {
      return res.status(200).send();
    }
    
    // Get user from session
    if (req.session && req.session.userId) {
      const userId = req.session.userId;
      const user = await User.findById(userId);
      
      if (user && user.counter) {
        const counterId = user.counter;
        
        // Clear counter assignment in User model
        user.counter = null;
        await user.save();
        
        // Clear counter assignment in Counter model
        await Counter.updateOne(
          { counterId: parseInt(counterId) },
          { $set: { staffId: null, staffName: null } }
        );
        
        // Emit staff logout event
        io.emit('staffLogout', { counterId });
        
        // Force refresh of in-memory data
        await initializeFromDB();
        
        // Get updated counter staff information with IDs
        const staffInfo = await getCounterStaffInfo();
        
        // Create a deep copy of the queues to avoid reference issues
        const queuesCopy = {};
        Object.keys(queues).forEach(key => {
          queuesCopy[key] = [...queues[key]];
        });
        
        // Emit update to all clients
        io.emit('queueUpdate', { 
          queues: queuesCopy, 
          counters, 
          counterStaff: staffInfo.counterStaff,
          counterStaffIds: staffInfo.counterStaffIds
        });
      }
    }
    
    // Always return success, even if no session (for beacon requests)
    res.status(200).send();
  } catch (error) {
    // Always return success for beacon requests
    res.status(200).send();
  }
});

// Also support GET for beacon requests
app.get('/api/clear-counter-assignment', async (req, res) => {
  try {
    // Check if this is a page refresh
    const isRefresh = req.query.isRefresh === 'true';
    
    // If it's a refresh, don't clear the counter
    if (isRefresh) {
      return res.status(200).send();
    }
    
    // Get user from session
    if (req.session && req.session.userId) {
      const userId = req.session.userId;
      const user = await User.findById(userId);
      
      if (user && user.counter) {
        const counterId = user.counter;
        
        // Clear counter assignment in User model
        user.counter = null;
        await user.save();
        
        // Clear counter assignment in Counter model
        await Counter.updateOne(
          { counterId: parseInt(counterId) },
          { $set: { staffId: null, staffName: null } }
        );
        
        // Emit staff logout event
        io.emit('staffLogout', { counterId });
      }
    }
    
    // Always return success, even if no session
    res.status(200).send();
  } catch (error) {
    // Always return success
    res.status(200).send();
  }
});

// API endpoint to get a ticket by number
app.get('/api/tickets/by-number/:number', async (req, res) => {
  try {
    const ticketNumber = parseInt(req.params.number);
    
    if (isNaN(ticketNumber)) {
      return res.status(400).json({ message: 'Invalid ticket number' });
    }
    
    const ticket = await Ticket.findOne({ ticketNumber });
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    res.json({ ticket });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// API endpoint to delete tickets (admin only)
app.delete('/api/tickets/delete', isAdmin, async (req, res) => {
  try {
    const { ticketIds } = req.body;
    
    if (!ticketIds || !Array.isArray(ticketIds) || ticketIds.length === 0) {
      return res.status(400).json({ error: 'No ticket IDs provided' });
    }
    
    // Delete tickets from database
    const result = await Ticket.deleteMany({ _id: { $in: ticketIds } });
    
    // Remove deleted tickets from in-memory queues
    Object.keys(queues).forEach(counterId => {
      queues[counterId] = queues[counterId].filter(ticket => 
        !ticketIds.includes(ticket.id.toString())
      );
    });
    
    // Update counters if any deleted tickets were being served
    for (const counterId of Object.keys(counters)) {
      if (counters[counterId].current && 
          ticketIds.includes(counters[counterId].current.id.toString())) {
        counters[counterId].current = null;
        counters[counterId].status = 'available';
        
        // Update counter in database
        await Counter.findOneAndUpdate(
          { counterId: parseInt(counterId) },
          { status: 'available', currentTicket: null }
        );
      }
    }
    
    // Get counter staff information
    const staffInfo = await getCounterStaffInfo();
    
    // Broadcast update to all clients
    const queuesCopy = {};
    Object.keys(queues).forEach(key => {
      queuesCopy[key] = [...queues[key]];
    });
    
    io.emit('queueUpdate', { 
      queues: queuesCopy, 
      counters, 
      counterStaff: staffInfo.counterStaff,
      counterStaffIds: staffInfo.counterStaffIds
    });
    
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint for ticket history (public)
app.get('/api/tickets/history', async (req, res) => {
  try {
    const { status, service, date } = req.query;
    
    // Build query
    const query = {};
    if (status) query.status = status;
    if (service) query.service = service;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      
      query.createdAt = {
        $gte: startDate,
        $lt: endDate
      };
    }
    
    // Get tickets - increased limit to show more history
    const tickets = await Ticket.find(query)
      .sort({ createdAt: -1 })
      .limit(500)
      .select('ticketNumber customerName service customService counterId status createdAt calledAt completedAt serviceTime waitTime tellerName');
    
    res.json({ tickets });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add endpoint to get ticket statistics (public)
app.get('/api/stats', async (req, res) => {
  try {
    const totalTickets = await Ticket.countDocuments();
    const completedTickets = await Ticket.countDocuments({ status: 'completed' });
    const waitingTickets = await Ticket.countDocuments({ status: 'waiting' });
    const servingTickets = await Ticket.countDocuments({ status: 'serving' });
    
    // Calculate average wait time for completed tickets
    const completedTicketsData = await Ticket.find({ 
      status: 'completed',
      calledAt: { $exists: true },
      createdAt: { $exists: true }
    });
    
    let totalWaitTime = 0;
    let totalServiceTime = 0;
    
    completedTicketsData.forEach(ticket => {
      if (ticket.calledAt && ticket.createdAt) {
        const waitTimeMs = new Date(ticket.calledAt) - new Date(ticket.createdAt);
        totalWaitTime += waitTimeMs / 60000; // Convert to minutes
      }
      
      if (ticket.serviceTime) {
        totalServiceTime += ticket.serviceTime;
      }
    });
    
    const avgWaitTime = completedTicketsData.length > 0 ? 
      Math.round(totalWaitTime / completedTicketsData.length) : 0;
      
    const avgServiceTime = completedTicketsData.length > 0 ? 
      Math.round(totalServiceTime / completedTicketsData.length) : 0;
    
    // Get service distribution
    const serviceDistribution = await Ticket.aggregate([
      { $group: { _id: '$service', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      totalTickets,
      completedTickets,
      waitingTickets,
      servingTickets,
      avgWaitTime,
      avgServiceTime,
      serviceDistribution
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create default admin user if none exists
async function createDefaultAdmin() {
  try {
    const adminCount = await User.countDocuments({ role: 'admin' });
    
    if (adminCount === 0) {
      const defaultAdmin = new User({
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@bankqueue.com',
        password: 'admin123',
        role: 'admin'
      });
      
      await defaultAdmin.save();
    }
  } catch (error) {
    // Error handling without logging
  }
}

// Function to log out all users on server restart
async function logoutNonAdminUsers() {
  try {
    // Set connected status to 'no' for all users
    await User.updateMany({}, { $set: { connected: 'no' } });
    
    // Keep counter assignments for admin users but don't mark them as connected
    // They will be marked as connected when they actually connect
    
    return;
  } catch (error) {
    // Error handling without logging
  }
}

// Function to clean up orphaned counter assignments
async function cleanupOrphanedCounters() {
  try {
    // Clear counter assignments for disconnected users
    await User.updateMany(
      { connected: 'no', counter: { $ne: null } },
      { $set: { counter: null } }
    );
    
    // Clear Counter model assignments for disconnected users
    const disconnectedUsers = await User.find({ connected: 'no' }).select('_id');
    const disconnectedUserIds = disconnectedUsers.map(u => u._id);
    
    await Counter.updateMany(
      { staffId: { $in: disconnectedUserIds } },
      { $set: { staffId: null, staffName: null } }
    );
    
    // Get all counters with staff assigned
    const countersWithStaff = await Counter.find({ staffId: { $ne: null } });
    
    for (const counter of countersWithStaff) {
      // Check if the assigned user exists and still has this counter assigned
      const user = await User.findOne({ _id: counter.staffId, counter: counter.counterId.toString() });
      
      if (!user) {
        // This is an orphaned assignment, clear it
        counter.staffId = null;
        counter.staffName = null;
        await counter.save();
        
        // Emit staff logout event
        io.emit('staffLogout', { counterId: counter.counterId.toString() });
      }
    }
    
    // Also check for users with counter assignments that don't match Counter model
    const usersWithCounters = await User.find({ counter: { $ne: null } });
    
    for (const user of usersWithCounters) {
      const counter = await Counter.findOne({ 
        counterId: parseInt(user.counter),
        staffId: user._id
      });
      
      if (!counter) {
        // This is an orphaned assignment in User model, clear it
        user.counter = null;
        await user.save();
      }
    }
    
    
    // Get updated counter staff information with IDs
    const staffInfo = await getCounterStaffInfo();
    
    // Create a deep copy of the queues to avoid reference issues
    const queuesCopy = {};
    Object.keys(queues).forEach(key => {
      queuesCopy[key] = [...queues[key]];
    });
    
    // Emit update to all clients
    io.emit('queueUpdate', { 
      queues: queuesCopy, 
      counters, 
      counterStaff: staffInfo.counterStaff,
      counterStaffIds: staffInfo.counterStaffIds
    });
  } catch (error) {
    // Error handling without logging
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {


  // Create default admin user
  await createDefaultAdmin();
  
  // Log out all non-admin users on server start
  await logoutNonAdminUsers();
  
  // Run initial cleanup of orphaned counter assignments
  await cleanupOrphanedCounters();
  
  // Schedule periodic cleanup every 5 minutes
  setInterval(cleanupOrphanedCounters, 5 * 60 * 1000);
  
  console.log(`Server started on port ${PORT}`);
});