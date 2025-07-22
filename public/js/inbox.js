document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    checkAuth();
    
    // DOM elements
    const messageList = document.getElementById('messageList');
    const messageView = document.getElementById('messageView');
    const composeBtn = document.getElementById('composeBtn');
    const composeModal = document.getElementById('composeModal');
    const closeModal = document.querySelector('.close');
    const cancelCompose = document.getElementById('cancelCompose');
    const composeForm = document.getElementById('composeForm');
    const recipientSelect = document.getElementById('recipient');
    const inboxNavItems = document.querySelectorAll('.inbox-nav li');
    const unreadCountBadge = document.getElementById('unreadCount');
    
    let currentFolder = 'inbox';
    let currentMessages = [];
    let selectedMessageId = null;
    let currentUserId = null;
    
    // Connect to Socket.IO for real-time notifications
    const socket = io();
    
    // Listen for new message notifications
    socket.on('newMessage', function(data) {
        // Check if this message is for the current user
        if (data.recipientId === currentUserId) {
            // Show notification
            showNotification(data.senderName, data.subject);
            
            // Update unread count and refresh messages if in inbox
            updateUnreadCount();
            if (currentFolder === 'inbox') {
                loadMessages();
            }
        }
    });
    
    // Function to show browser notification
    function showNotification(sender, subject) {
        // Check if browser supports notifications
        if (!('Notification' in window)) {
            return;
        }
        
        // Check if permission is already granted
        if (Notification.permission === 'granted') {
            createNotification(sender, subject);
        }
        // Otherwise, request permission
        else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(function(permission) {
                if (permission === 'granted') {
                    createNotification(sender, subject);
                }
            });
        }
    }
    
    // Create and show notification
    function createNotification(sender, subject) {
        const notification = new Notification('New Message', {
            body: `From: ${sender}\nSubject: ${subject}`,
            icon: '/images/favicon.jpeg'
        });
        
        notification.onclick = function() {
            window.focus();
            if (window.location.pathname !== '/inbox') {
                window.location.href = '/inbox';
            }
            this.close();
        };
        
        // Auto close after 5 seconds
        setTimeout(notification.close.bind(notification), 5000);
    }
    
    // Initialize
    loadUsers();
    loadMessages();
    updateUnreadCount();
    
    // Set up event listeners
    composeBtn.addEventListener('click', openComposeModal);
    closeModal.addEventListener('click', closeComposeModal);
    cancelCompose.addEventListener('click', closeComposeModal);
    composeForm.addEventListener('submit', sendMessage);
    
    inboxNavItems.forEach(item => {
        item.addEventListener('click', () => {
            const folder = item.getAttribute('data-folder');
            changeFolder(folder);
        });
    });
    
    // Check authentication
    function checkAuth() {
        fetch('/api/auth/me')
            .then(response => {
                if (!response.ok) {
                    window.location.href = '/login';
                    throw new Error('Not authenticated');
                }
                return response.json();
            })
            .then(data => {
                document.getElementById('userName').textContent = `${data.user.firstName} ${data.user.lastName}`;
                document.getElementById('userRole').textContent = data.user.role;
                currentUserId = data.user._id;
            })
            .catch(error => {
                console.error('Authentication error:', error);
            });
    }
    
    // Load users for recipient dropdown
    function loadUsers() {
        fetch('/api/messages/users/list')
            .then(response => response.json())
            .then(data => {
                recipientSelect.innerHTML = '<option value="">Select recipient</option>';
                
                data.users.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user._id;
                    option.textContent = `${user.firstName} ${user.lastName} (${user.role})`;
                    recipientSelect.appendChild(option);
                });
            })
            .catch(error => {
                console.error('Error loading users:', error);
            });
    }
    
    // Load messages based on current folder
    function loadMessages() {
        fetch('/api/messages')
            .then(response => response.json())
            .then(data => {
                currentMessages = currentFolder === 'inbox' ? data.receivedMessages : data.sentMessages;
                renderMessageList();
            })
            .catch(error => {
                console.error('Error loading messages:', error);
            });
    }
    
    // Update unread message count
    function updateUnreadCount() {
        fetch('/api/messages/unread')
            .then(response => response.json())
            .then(data => {
                const count = data.unreadCount;
                unreadCountBadge.textContent = count;
                
                if (count === 0) {
                    unreadCountBadge.style.display = 'none';
                } else {
                    unreadCountBadge.style.display = 'inline';
                }
                
                // Also update the sidebar badge
                if (typeof window.updateInboxBadge === 'function') {
                    window.updateInboxBadge();
                }
            })
            .catch(error => {
                console.error('Error updating unread count:', error);
            });
    }
    
    // Render message list
    function renderMessageList() {
        if (currentMessages.length === 0) {
            messageList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-envelope-open"></i>
                    <p>No messages to display</p>
                </div>
            `;
            return;
        }
        
        messageList.innerHTML = '';
        
        // Group messages by sender/recipient
        const groupedMessages = {};
        const isInbox = currentFolder === 'inbox';
        
        currentMessages.forEach(message => {
            let person, personId, personName;
            
            // Handle system messages
            if (isInbox && message.isSystemMessage && message.systemSender) {
                personId = 'system-' + message.systemSender.toLowerCase().replace(/\s+/g, '-');
                personName = message.systemSender;
            } else {
                person = isInbox ? message.sender : message.recipient;
                if (!person) return;
                
                personId = person._id;
                personName = `${person.firstName} ${person.lastName}`;
            }
            
            if (!groupedMessages[personId]) {
                groupedMessages[personId] = {
                    name: personName,
                    messages: [],
                    hasUnread: false
                };
            }
            
            groupedMessages[personId].messages.push(message);
            
            // Check if there are any unread messages
            if (isInbox && !message.read) {
                groupedMessages[personId].hasUnread = true;
            }
        });
        
        // Create message groups
        Object.keys(groupedMessages).forEach(personId => {
            const group = groupedMessages[personId];
            const messages = group.messages;
            
            // Sort messages by date (newest first)
            messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            // Create group header
            const groupHeader = document.createElement('div');
            groupHeader.className = `message-group-header ${group.hasUnread ? 'has-unread' : ''}`;
            groupHeader.innerHTML = `
                <div class="group-name">${group.name}</div>
                <div class="group-count">${messages.length} message${messages.length > 1 ? 's' : ''}</div>
                <div class="group-toggle"><i class="fas fa-chevron-right"></i></div>
            `;
            
            // Create group container
            const groupContainer = document.createElement('div');
            groupContainer.className = 'message-group collapsed';
            groupContainer.dataset.personId = personId;
            
            // Add group header to container
            groupContainer.appendChild(groupHeader);
            
            // Create messages container
            const messagesContainer = document.createElement('div');
            messagesContainer.className = 'message-group-items';
            
            // Add messages to container
            messages.forEach(message => {
                const messageItem = document.createElement('div');
                messageItem.className = `message-item ${isInbox && !message.read ? 'unread' : ''}`;
                messageItem.dataset.id = message._id;
                
                if (selectedMessageId === message._id) {
                    messageItem.classList.add('active');
                }
                
                messageItem.innerHTML = `
                    <div class="message-subject">${message.subject}</div>
                    <div class="message-preview">${message.content.substring(0, 60)}${message.content.length > 60 ? '...' : ''}</div>
                    <div class="message-time">${formatDate(message.createdAt)}</div>
                `;
                
                messageItem.addEventListener('click', () => {
                    viewMessage(message._id);
                });
                
                messagesContainer.appendChild(messageItem);
            });
            
            // Add messages container to group container
            groupContainer.appendChild(messagesContainer);
            
            // Add group container to message list
            messageList.appendChild(groupContainer);
            
            // Add click event to toggle group
            groupHeader.addEventListener('click', () => {
                // Close all other groups first
                document.querySelectorAll('.message-group').forEach(group => {
                    if (group !== groupContainer) {
                        group.classList.add('collapsed');
                        const otherIcon = group.querySelector('.group-toggle i');
                        if (otherIcon) {
                            otherIcon.className = 'fas fa-chevron-right';
                        }
                    }
                });
                
                // Toggle this group
                groupContainer.classList.toggle('collapsed');
                const icon = groupHeader.querySelector('.group-toggle i');
                if (groupContainer.classList.contains('collapsed')) {
                    icon.className = 'fas fa-chevron-right';
                } else {
                    icon.className = 'fas fa-chevron-down';
                }
            });
            
            // If this group has the selected message, make sure it's expanded
            if (selectedMessageId && messages.some(m => m._id === selectedMessageId)) {
                // Close all other groups
                document.querySelectorAll('.message-group').forEach(group => {
                    if (group !== groupContainer) {
                        group.classList.add('collapsed');
                        const otherIcon = group.querySelector('.group-toggle i');
                        if (otherIcon) {
                            otherIcon.className = 'fas fa-chevron-right';
                        }
                    }
                });
                
                // Expand this group
                groupContainer.classList.remove('collapsed');
                const icon = groupHeader.querySelector('.group-toggle i');
                icon.className = 'fas fa-chevron-down';
            }
            
            // If this group has unread messages, expand it by default
            if (group.hasUnread && !selectedMessageId) {
                groupContainer.classList.remove('collapsed');
                const icon = groupHeader.querySelector('.group-toggle i');
                icon.className = 'fas fa-chevron-down';
            }
        });
    }
    
    // View a specific message
    function viewMessage(messageId) {
        selectedMessageId = messageId;
        
        // Find the message item and its parent group
        const messageItem = document.querySelector(`.message-item[data-id="${messageId}"]`);
        if (messageItem) {
            // Update active class
            document.querySelectorAll('.message-item').forEach(item => {
                item.classList.remove('active');
            });
            messageItem.classList.add('active');
            
            // Find the parent group and expand it
            const parentGroup = messageItem.closest('.message-group');
            if (parentGroup) {
                // Collapse all groups
                document.querySelectorAll('.message-group').forEach(group => {
                    group.classList.add('collapsed');
                    const icon = group.querySelector('.group-toggle i');
                    if (icon) {
                        icon.className = 'fas fa-chevron-right';
                    }
                });
                
                // Expand this group
                parentGroup.classList.remove('collapsed');
                const icon = parentGroup.querySelector('.group-toggle i');
                if (icon) {
                    icon.className = 'fas fa-chevron-down';
                }
            }
        }
        
        // Find the message
        const message = currentMessages.find(m => m._id === messageId);
        
        if (!message) {
            return;
        }
        
        const isInbox = currentFolder === 'inbox';
        let sender;
        if (message.isSystemMessage && message.systemSender) {
            sender = message.systemSender;
        } else {
            sender = message.sender ? `${message.sender.firstName} ${message.sender.lastName}` : 'Unknown User';
        }
        const recipient = message.recipient ? `${message.recipient.firstName} ${message.recipient.lastName}` : 'Unknown User';
        
        messageView.innerHTML = `
            <div class="message-header">
                <h2 class="message-subject-header">${message.subject}</h2>
                <div class="message-info">
                    <div class="message-sender-info">
                        ${isInbox ? 'From: ' + sender : 'To: ' + recipient}
                    </div>
                    <div class="message-date">${formatFullDate(message.createdAt)}</div>
                </div>
            </div>
            <div class="message-body">
                ${message.content.replace(/\\n/g, '<br>')}
            </div>
            ${message.relatedTicket ? `
                <div class="message-related-ticket">
                    Related to Ticket #${message.relatedTicket.ticketNumber}
                </div>
            ` : ''}
            <div class="message-actions">
                ${isInbox && !message.isSystemMessage ? `
                    <button class="btn-reply" data-id="${message._id}">
                        <i class="fas fa-reply"></i> Reply
                    </button>
                ` : ''}
                <button class="btn-delete" data-id="${message._id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        
        // Mark as read if it's an inbox message
        if (isInbox && !message.read) {
            markAsRead(messageId);
        }
        
        // Add event listeners for reply and delete buttons
        const replyBtn = messageView.querySelector('.btn-reply');
        if (replyBtn) {
            replyBtn.addEventListener('click', () => {
                replyToMessage(message);
            });
        }
        
        const deleteBtn = messageView.querySelector('.btn-delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                deleteMessage(messageId);
            });
        }
    }
    
    // Mark message as read
    function markAsRead(messageId) {
        fetch(`/api/messages/${messageId}/read`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(() => {
            // Update the message in the current messages array
            const message = currentMessages.find(m => m._id === messageId);
            if (message) {
                message.read = true;
            }
            
            // Update the UI
            const messageItem = document.querySelector(`.message-item[data-id="${messageId}"]`);
            if (messageItem) {
                messageItem.classList.remove('unread');
            }
            
            // Update unread count
            updateUnreadCount();
        })
        .catch(error => {
            console.error('Error marking message as read:', error);
        });
    }
    
    // Delete a message
    function deleteMessage(messageId) {
        // Create a custom confirmation dialog
        const confirmDialog = document.createElement('div');
        confirmDialog.className = 'custom-confirm';
        confirmDialog.innerHTML = `
            <div class="custom-confirm-content">
                <div class="custom-confirm-header">
                    <h3>Confirm Deletion</h3>
                </div>
                <div class="custom-confirm-body">
                    <p>Are you sure you want to delete this message?</p>
                </div>
                <div class="custom-confirm-footer">
                    <button class="btn-cancel">Cancel</button>
                    <button class="btn-confirm">Delete</button>
                </div>
            </div>
        `;
        document.body.appendChild(confirmDialog);
        
        // Add event listeners
        const cancelBtn = confirmDialog.querySelector('.btn-cancel');
        const confirmBtn = confirmDialog.querySelector('.btn-confirm');
        
        cancelBtn.addEventListener('click', () => {
            confirmDialog.remove();
        });
        
        confirmBtn.addEventListener('click', () => {
            confirmDialog.remove();
            performDelete(messageId);
        });
        
        // Show dialog with animation
        setTimeout(() => {
            confirmDialog.classList.add('show');
        }, 10);
    }
    
    // Perform the actual deletion
    function performDelete(messageId) {
        
        fetch(`/api/messages/${messageId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Find the message to be deleted
                const deletedMessage = currentMessages.find(m => m._id === messageId);
                
                // Remove from current messages
                currentMessages = currentMessages.filter(m => m._id !== messageId);
                
                // Update UI
                renderMessageList();
                
                // Clear message view if the deleted message was selected
                if (selectedMessageId === messageId) {
                    selectedMessageId = null;
                    messageView.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-envelope"></i>
                            <p>Select a message to view</p>
                        </div>
                    `;
                }
                
                // Update unread count if needed
                if (currentFolder === 'inbox' && deletedMessage && !deletedMessage.read) {
                    updateUnreadCount();
                }
            }
        })
        .catch(error => {
            console.error('Error deleting message:', error);
        });
    }
    
    // Reply to a message
    function replyToMessage(message) {
        // Open compose modal
        openComposeModal();
        
        // Pre-fill recipient
        document.getElementById('recipient').value = message.sender._id;
        
        // Pre-fill subject with Re: prefix if not already there
        let subject = message.subject;
        if (!subject.startsWith('Re:')) {
            subject = 'Re: ' + subject;
        }
        document.getElementById('subject').value = subject;
        
        // Pre-fill related ticket if any
        if (message.relatedTicket) {
            document.getElementById('relatedTicket').value = message.relatedTicket.ticketNumber;
        }
        
        // Add reply-to header if sender is a temporary user
        if (message.sender.email && message.sender.role === 'temporary') {
            // Store the email in a hidden field or data attribute
            const recipientEmailField = document.getElementById('recipientEmail');
            if (recipientEmailField) {
                recipientEmailField.value = message.sender.email;
            } else {
                // Create a hidden field if it doesn't exist
                const hiddenField = document.createElement('input');
                hiddenField.type = 'hidden';
                hiddenField.id = 'recipientEmail';
                hiddenField.name = 'recipientEmail';
                hiddenField.value = message.sender.email;
                document.getElementById('composeForm').appendChild(hiddenField);
            }
        }
        
        // Focus on message content
        document.getElementById('messageContent').focus();
    }
    
    // Change folder (inbox/sent)
    function changeFolder(folder) {
        currentFolder = folder;
        
        // Update active class
        inboxNavItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-folder') === folder) {
                item.classList.add('active');
            }
        });
        
        // Reset selected message
        selectedMessageId = null;
        
        // Clear message view
        messageView.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-envelope"></i>
                <p>Select a message to view</p>
            </div>
        `;
        
        // Load messages for the selected folder
        loadMessages();
    }
    
    // Open compose modal
    function openComposeModal() {
        composeModal.style.display = 'block';
        composeForm.reset();
    }
    
    // Close compose modal
    function closeComposeModal() {
        composeModal.style.display = 'none';
        composeForm.reset();
    }
    
    // Send a message
    function sendMessage(e) {
        e.preventDefault();
        
        const recipientId = document.getElementById('recipient').value;
        const subject = document.getElementById('subject').value;
        const content = document.getElementById('messageContent').value;
        const ticketNumber = document.getElementById('relatedTicket').value;
        
        // Validate form
        if (!recipientId || !subject || !content) {
            window.notifications.error('Form Error', 'Please fill in all required fields');
            return;
        }
        
        // Prepare message data
        const messageData = {
            recipientId,
            subject,
            content
        };
        
        // Add related ticket if provided
        if (ticketNumber) {
            // We'll need to fetch the ticket ID from the ticket number
            fetch(`/api/tickets/by-number/${ticketNumber}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Ticket not found');
                    }
                    return response.json();
                })
                .then(data => {
                    messageData.relatedTicket = data.ticket._id;
                    sendMessageToServer(messageData);
                })
                .catch(error => {
                    // If ticket not found, send message without ticket reference
                    console.warn('Ticket not found, sending message without reference:', error);
                    sendMessageToServer(messageData);
                });
        } else {
            // Send message without ticket reference
            sendMessageToServer(messageData);
        }
    }
    
    // Send message to server
    function sendMessageToServer(messageData) {
        // Check if we have a recipient email (for temporary users)
        const recipientEmail = document.getElementById('recipientEmail').value;
        if (recipientEmail) {
            messageData.recipientEmail = recipientEmail;
        }
        
        fetch('/api/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(messageData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.messageId) {
                // Close modal
                closeComposeModal();
                
                // Switch to sent folder
                changeFolder('sent');
                
                // Show success message
                window.notifications.success('Success', 'Message sent successfully');
            } else {
                window.notifications.error('Error', 'Error sending message: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error sending message:', error);
            window.notifications.error('Error', 'Error sending message. Please try again.');
        });
    }
    
    // Format date for message list (today, yesterday, or date)
    function formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    }
    
    // Format full date for message view
    function formatFullDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString([], { 
            weekday: 'short',
            month: 'short', 
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    // Poll for new messages every 30 seconds
    setInterval(() => {
        loadMessages();
        updateUnreadCount();
    }, 30000);
    
    // Debug function to create a test message (can be called from console)
    window.createTestMessage = function() {
        if (!currentUserId) {
            console.error('User ID not available yet');
            return;
        }
        
        const messageData = {
            recipientId: currentUserId,
            subject: 'Test Message',
            content: 'This is a test message to verify the badge system.'
        };
        
        fetch('/api/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(messageData)
        })
        .then(response => response.json())
        .then(data => {
            console.log('Test message created:', data);
            window.notifications.info('Test Message', 'Test message created. You should see a badge on the inbox link.');
            // Force update of unread count
            updateUnreadCount();
        })
        .catch(error => {
            console.error('Error creating test message:', error);
        });
    };
});