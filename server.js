// Initialize data from MongoDB
async function initializeFromDB() {
  try {
    // Get the latest ticket number
    const latestTicket = await Ticket.findOne().sort({ ticketNumber: -1 });
    if (latestTicket) {
      ticketCounter = latestTicket.ticketNumber;
      console.log('Initialized ticket counter to:', ticketCounter);
    } else {
      ticketCounter = 0; // Will be incremented to 1 when first ticket is created
      console.log('No tickets found in database. Initializing counter to 0.');
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