const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Set Node TLS options to fix SSL issues
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/bankQueue', {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Initialize counters if they don't exist
    const Counter = require('../models/Counter');
    const counters = [
      { counterId: 1, name: 'Account Opening', service: 'Account Opening', status: 'available' },
      { counterId: 2, name: 'Loan Application', service: 'Loan Application', status: 'available' },
      { counterId: 3, name: 'Money Transfer', service: 'Money Transfer', status: 'available' },
      { counterId: 4, name: 'Card Services', service: 'Card Services', status: 'available' },
      { counterId: 5, name: 'General Inquiry', service: 'General Inquiry', status: 'available' }
    ];
    
    for (const counter of counters) {
      await Counter.findOneAndUpdate(
        { counterId: counter.counterId },
        counter,
        { upsert: true, new: true }
      );
    }
    
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;