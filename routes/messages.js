const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const { isAuthenticated } = require('../middleware/auth');

// Get all messages for the current user
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    
    // Get received messages
    const receivedMessages = await Message.find({ recipient: userId })
      .populate('sender', 'firstName lastName email')
      .populate('relatedTicket', 'ticketNumber')
      .sort({ createdAt: -1 });
      
    // Add system sender information for system messages
    receivedMessages.forEach(message => {
      if (message.isSystemMessage && message.systemSender) {
        message.sender = {
          _id: 'system-' + message.systemSender.toLowerCase().replace(/\\s+/g, '-'),
          firstName: message.systemSender,
          lastName: ''
        };
      }
    });
    
    // Get sent messages
    const sentMessages = await Message.find({ sender: userId })
      .populate('recipient', 'firstName lastName')
      .populate('relatedTicket', 'ticketNumber')
      .sort({ createdAt: -1 });
    
    res.json({ receivedMessages, sentMessages });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get unread message count
router.get('/unread', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    
    const unreadCount = await Message.countDocuments({ 
      recipient: userId,
      read: false
    });
    
    res.json({ unreadCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific message
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const messageId = req.params.id;
    
    const message = await Message.findById(messageId)
      .populate('sender', 'firstName lastName email')
      .populate('recipient', 'firstName lastName')
      .populate('relatedTicket', 'ticketNumber customerName service');
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    // Check if user is authorized to view this message
    if (message.sender.toString() !== userId && message.recipient.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to view this message' });
    }
    
    // Mark as read if recipient is viewing
    if (message.recipient.toString() === userId && !message.read) {
      message.read = true;
      await message.save();
    }
    
    res.json({ message });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Send a new message
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { recipientId, recipientEmail, subject, content, relatedTicket } = req.body;
    
    if (!recipientId || !subject || !content) {
      return res.status(400).json({ message: 'Recipient, subject and content are required' });
    }
    
    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }
    
    // Get sender info for notification
    const sender = await User.findById(req.session.userId).select('firstName lastName email');
    
    const newMessage = new Message({
      sender: req.session.userId,
      recipient: recipientId,
      subject,
      content,
      relatedTicket: relatedTicket || null
    });
    
    await newMessage.save();
    
    // Emit a Socket.IO event to notify the recipient if they're a regular user
    if (recipient.role !== 'temporary') {
      try {
        const io = req.app.get('io');
        if (io) {
          io.emit('newMessage', { 
            recipientId, 
            messageId: newMessage._id,
            subject,
            senderName: `${sender.firstName} ${sender.lastName}`
          });
        }
      } catch (socketError) {
        // Continue even if socket notification fails
      }
    }
    
    // If recipient is a temporary user and we have their email, send them an email notification
    // This would require an email sending service, which is not implemented in this example
    // But you could add code here to send an email to recipientEmail
    
    res.status(201).json({ message: 'Message sent successfully', messageId: newMessage._id });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark message as read
router.put('/:id/read', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const messageId = req.params.id;
    
    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    // Check if user is the recipient
    if (message.recipient.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to mark this message as read' });
    }
    
    message.read = true;
    await message.save();
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a message
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const messageId = req.params.id;
    
    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    // Check if user is the sender or recipient
    if (message.sender.toString() !== userId && message.recipient.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }
    
    await Message.findByIdAndDelete(messageId);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users for message recipients
router.get('/users/list', isAuthenticated, async (req, res) => {
  try {
    const users = await User.find()
      .select('firstName lastName email role')
      .sort({ firstName: 1 });
    
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Send a message from display screen to teller
router.post('/display-to-teller', async (req, res) => {
  try {
    const { tellerId, senderEmail, senderName, subject, content } = req.body;
    
    if (!tellerId || !senderEmail || !senderName || !subject || !content) {
      return res.status(400).json({ message: 'Teller ID, sender email, sender name, subject and content are required' });
    }
    
    // Check if recipient exists
    const recipient = await User.findById(tellerId);
    if (!recipient) {
      return res.status(404).json({ message: 'Teller not found' });
    }
    
    // Check if a temporary user with this email already exists
    let sender = await User.findOne({ email: senderEmail, role: 'temporary' });
    
    // If not, create a temporary user
    if (!sender) {
      sender = new User({
        firstName: senderName.split(' ')[0] || senderName,
        lastName: senderName.split(' ').slice(1).join(' ') || '',
        email: senderEmail,
        role: 'temporary',
        password: Math.random().toString(36).substring(2, 15) // Random password, not used for login
      });
      
      await sender.save();
    }
    
    const newMessage = new Message({
      sender: sender._id,
      recipient: tellerId,
      subject,
      content
    });
    
    await newMessage.save();
    
    // Emit a Socket.IO event to notify the recipient
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('newMessage', { 
          recipientId: tellerId, 
          messageId: newMessage._id,
          subject,
          senderName: senderName
        });
      }
    } catch (socketError) {
      // Continue even if socket notification fails
    }
    
    res.status(201).json({ message: 'Message sent successfully', messageId: newMessage._id });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;