const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  callerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  callerName: {
    type: String,
    required: true
  },
  recipientName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['incoming', 'outgoing', 'missed'],
    required: true
  },
  status: {
    type: String,
    enum: ['initiated', 'answered', 'declined', 'ended', 'missed'],
    default: 'initiated'
  },
  duration: {
    type: Number, // in seconds
    default: 0
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Call', callSchema);