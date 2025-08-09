const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  ticketNumber: {
    type: Number,
    required: true
  },
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  service: {
    type: String,
    required: true
  },
  language: {
    type: String,
    required: true
  },
  counterId: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['waiting', 'serving', 'completed', 'no-show'],
    default: 'waiting'
  },
  waitTime: {
    type: Number,
    default: 0 // Time in minutes
  },
  serviceTime: {
    type: Number,
    default: 0 // Time in minutes
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  calledAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  notes: {
    type: String
  },
  customService: {
    type: String
  },
  tellerName: {
    type: String
  }
});

const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;