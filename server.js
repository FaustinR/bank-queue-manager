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
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const { isAuthenticated, isAdmin, isStaff } = require('./middleware/auth');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(express.static('public'));
app.use(express.json());

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'bank-queue-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: process.env.MONGO_URI || 'mongodb://localhost:27017/bankQueue',
    ttl: 14 * 24 * 60 * 60 // 14 days
  }),
  cookie: {
    maxAge: 14 * 24 * 60 * 60 * 1000 // 14 days in milliseconds
  }
}));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

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
    }
    
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
        counters[counter.counterId].status = counter.status;
        if (counter.currentTicket) {
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
        }
      }
    });
    
    console.log('Data initialized from MongoDB');
  } catch (error) {
    console.error('Error initializing data from MongoDB:', error);
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
  // If already logged in, redirect based on role
  if (req.session.userId) {
    if (req.session.userRole === 'admin' || req.session.userRole === 'supervisor') {
      return res.redirect('/admin');
    } else {
      return res.redirect('/display');
    }
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Staff routes (require authentication)
app.get('/display', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'display.html'));
});

app.get('/counter/:id', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'counter.html'));
});

app.get('/history', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'history.html'));
});

// Middleware to check for full admin rights (not supervisor)
const isFullAdmin = (req, res, next) => {
  if (req.session && req.session.userRole === 'admin') {
    return next();
  }
  
  return res.redirect('/admin');
};

// Admin routes
app.get('/admin', isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/signup', isAdmin, isFullAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/users', isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'users.html'));
});

// API endpoints
app.post('/api/ticket', async (req, res) => {
  try {
    const { customerName, service, language } = req.body;
    console.log('Received request body:', req.body); // Debug log
    console.log('Service type:', typeof service, 'Service value:', service);
    
    if (!customerName || !service || !language) {
      console.log('Missing required fields:', { customerName, service, language });
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
      console.log('Custom service detected, assigning to General Inquiry counter:', service);
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
    
    // Broadcast to all displays
    io.emit('queueUpdate', { queues, counters });
    
    console.log('Sending ticket response:', ticket); // Debug log
    res.json(ticket);
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/queue', async (req, res) => {
  try {
    // Get fresh data from MongoDB
    await initializeFromDB();
    res.json({ queues, counters });
  } catch (error) {
    console.error('Error fetching queue data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/counter/:id/next', async (req, res) => {
  const counterId = parseInt(req.params.id);
  
  try {
    if (queues[counterId] && queues[counterId].length > 0) {
      const nextCustomer = queues[counterId].shift();
      counters[counterId].current = nextCustomer;
      counters[counterId].status = 'serving';
      
      // Update ticket in MongoDB
      const ticket = await Ticket.findById(nextCustomer.id);
      if (ticket) {
        ticket.status = 'serving';
        ticket.calledAt = new Date();
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
      
      io.emit('queueUpdate', { queues, counters });
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
    console.error('Error calling next customer:', error);
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
        ticket.completedAt = new Date();
        
        // Calculate service time if calledAt exists
        if (ticket.calledAt) {
          const serviceTimeMs = new Date() - ticket.calledAt;
          ticket.serviceTime = Math.round(serviceTimeMs / 60000); // Convert to minutes
        }
        
        await ticket.save();
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
    
    io.emit('queueUpdate', { queues, counters });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error completing service:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Client connected');
  
  // Send current state to new client
  socket.emit('queueUpdate', { queues, counters });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// API endpoint for ticket history
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
    
    // Get tickets
    const tickets = await Ticket.find(query)
      .sort({ createdAt: -1 })
      .limit(100);
    
    res.json({ tickets });
  } catch (error) {
    console.error('Error fetching ticket history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add endpoint to get ticket statistics
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
    console.error('Error fetching statistics:', error);
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
      console.log('Default admin user created');
      console.log('Email: admin@bankqueue.com');
      console.log('Password: admin123');
    }
  } catch (error) {
    console.error('Error creating default admin:', error);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Kiosk: http://localhost:${PORT}`);
  console.log(`Login: http://localhost:${PORT}/login`);
  console.log(`Display: http://localhost:${PORT}/display`);
  Object.keys(counters).forEach(id => {
    console.log(`Counter ${id} (${counters[id].name}): http://localhost:${PORT}/counter/${id}`);
  });
  
  // Create default admin user
  createDefaultAdmin();
});