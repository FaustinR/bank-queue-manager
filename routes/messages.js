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
      .sort({ createdAt: -1 })
      .select('sender recipient subject content messageType voiceNoteData relatedTicket read isSystemMessage systemSender createdAt');
      
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
      .sort({ createdAt: -1 })
      .select('sender recipient subject content messageType voiceNoteData relatedTicket read isSystemMessage systemSender createdAt');
    
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

// Get current user's counter ID
router.get('/current-counter', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    
    // Get the user's counter
    const user = await User.findById(userId).select('counter');
    
    if (!user || !user.counter) {
      return res.json({ counterId: null });
    }
    
    res.json({ counterId: user.counter });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get unread message count by counter (public endpoint for display screen)
router.get('/unread-by-counter', async (req, res) => {
  try {
    
    // Get all users with counters
    const usersWithCounters = await User.find({ counter: { $ne: null } })
      .select('_id counter');
    
    // Create a map of user IDs to counter IDs
    const userToCounter = {};
    usersWithCounters.forEach(user => {
      userToCounter[user._id.toString()] = user.counter;
    });
    
    // Get all unread messages
    const unreadMessages = await Message.find({ read: false })
      .select('recipient');
    
    // Count unread messages by counter
    const unreadByCounter = {};
    unreadMessages.forEach(message => {
      const recipientId = message.recipient.toString();
      const counterId = userToCounter[recipientId];
      
      if (counterId) {
        unreadByCounter[counterId] = (unreadByCounter[counterId] || 0) + 1;
      }
    });
    
    // No need to add test data anymore
    // Just return the actual unread messages by counter
    
    res.json({ unreadByCounter });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete chats (all messages with specific person IDs) - MUST be before /:id route
router.delete('/delete-chats', isAuthenticated, async (req, res) => {
  try {
    const { personIds, folder } = req.body;
    const userId = req.session.userId;
    
    if (!personIds || !Array.isArray(personIds)) {
      return res.status(400).json({ message: 'Person IDs are required' });
    }
    
    // Delete messages based on folder
    if (folder === 'inbox') {
      // Delete received messages from these senders
      await Message.deleteMany({
        recipient: userId,
        sender: { $in: personIds }
      });
    } else if (folder === 'sent') {
      // Delete sent messages to these recipients
      await Message.deleteMany({
        sender: userId,
        recipient: { $in: personIds }
      });
    }
    
    res.json({ success: true });
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
    const { recipientId, recipientEmail, subject, content, relatedTicket, messageType, voiceNoteData } = req.body;
    
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
      relatedTicket: relatedTicket || null,
      messageType: messageType || 'text',
      voiceNoteData: voiceNoteData || null
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
    const { tellerId, senderEmail, senderName, subject, content, voiceNoteData, messageType } = req.body;
    
    // Process message data
    
    if (!tellerId || !senderEmail || !senderName || !subject || !content) {
      return res.status(400).json({ message: 'Teller ID, sender email, sender name, subject and content are required' });
    }
    
    // Check if recipient exists
    const recipient = await User.findById(tellerId);
    if (!recipient) {
      return res.status(404).json({ message: 'Teller not found' });
    }
    
    try {
      // Check if a temporary user with this email already exists
      let sender = await User.findOne({ email: senderEmail });
      
      // If not, create a temporary user
      if (!sender) {
        // Make sure we have a valid firstName and lastName
        const firstName = senderName.split(' ')[0] || 'Guest';
        const lastName = senderName.split(' ').slice(1).join(' ') || 'User';
        
        sender = new User({
          firstName,
          lastName,
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
        content,
        messageType: messageType || 'text',
        voiceNoteData: voiceNoteData || null
      });
      
      await newMessage.save();
      
      // Emit a Socket.IO event to notify the recipient
      try {
        const io = req.app.get('io');
        if (io) {
          // Get the counter ID for this recipient
          const recipientUser = await User.findById(tellerId).select('counter');
          const counterId = recipientUser?.counter || null;
          
          io.emit('newMessage', { 
            recipientId: tellerId, 
            messageId: newMessage._id,
            subject,
            senderName: senderName,
            counterId: counterId // Include the counter ID
          });
        }
      } catch (socketError) {
        // Continue even if socket notification fails
      }
      
      res.status(201).json({ message: 'Message sent successfully', messageId: newMessage._id });
    } catch (userError) {
      return res.status(400).json({ message: 'Error creating user: ' + userError.message });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

module.exports = router;