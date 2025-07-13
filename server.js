const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

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

// Services and their dedicated counters
const services = {
  'Account Opening': 1,
  'Loan Application': 2,
  'Money Transfer': 3,
  'Card Services': 4,
  'General Inquiry': 5
  // Other custom services will be handled dynamically
};

// Queue management - separate queue for each service
let queues = {
  1: [], // Account Opening
  2: [], // Loan Application
  3: [], // Money Transfer
  4: [], // Card Services
  5: []  // General Inquiry
};

let counters = {
  1: { name: 'Account Opening', current: null, status: 'available', service: 'Account Opening' },
  2: { name: 'Loan Application', current: null, status: 'available', service: 'Loan Application' },
  3: { name: 'Money Transfer', current: null, status: 'available', service: 'Money Transfer' },
  4: { name: 'Card Services', current: null, status: 'available', service: 'Card Services' },
  5: { name: 'General Inquiry', current: null, status: 'available', service: 'General Inquiry' }
};

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'kiosk.html'));
});

app.get('/display', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'display.html'));
});

app.get('/counter/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'counter.html'));
});

app.get('/ticket', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ticket.html'));
});

// API endpoints
app.post('/api/ticket', (req, res) => {
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
    
    // Handle custom services
    if (!counterId) {
      // Always assign custom services to General Inquiry counter
      counterId = 5;
      console.log('Custom service detected, assigning to General Inquiry counter:', service);
    }
    
    const ticket = {
      id: uuidv4(),
      number: queues[counterId].length + 1,
      customerName,
      service: serviceToUse,
      language,
      counterId,
      timestamp: new Date(),
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

app.get('/api/queue', (req, res) => {
  res.json({ queues, counters });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/counter/:id/next', (req, res) => {
  const counterId = parseInt(req.params.id);
  
  if (queues[counterId] && queues[counterId].length > 0) {
    const nextCustomer = queues[counterId].shift();
    counters[counterId].current = nextCustomer;
    counters[counterId].status = 'serving';
    
    io.emit('queueUpdate', { queues, counters });
    io.emit('customerCalled', { customer: nextCustomer, counter: counterId });
    
    res.json({ success: true, customer: nextCustomer });
  } else {
    res.json({ success: false, message: 'No customers in queue for this service' });
  }
});

app.post('/api/counter/:id/complete', (req, res) => {
  const counterId = parseInt(req.params.id);
  
  counters[counterId].current = null;
  counters[counterId].status = 'available';
  
  io.emit('queueUpdate', { queues, counters });
  
  res.json({ success: true });
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Kiosk: http://localhost:${PORT}`);
  console.log(`Display: http://localhost:${PORT}/display`);
  Object.keys(counters).forEach(id => {
    console.log(`Counter ${id} (${counters[id].name}): http://localhost:${PORT}/counter/${id}`);
  });
});