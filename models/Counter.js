const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  counterId: {
    type: Number,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  service: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['available', 'serving', 'break', 'closed'],
    default: 'available'
  },
  currentTicket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    default: null
  },
  totalServed: {
    type: Number,
    default: 0
  },
  averageServiceTime: {
    type: Number,
    default: 0 // Time in minutes
  },
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  staffName: {
    type: String,
    default: null
  }
});

const Counter = mongoose.model('Counter', counterSchema);

module.exports = Counter;