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
    const deleteChatBtn = document.getElementById('deleteChatBtn');
    
    let currentFolder = 'inbox';
    let currentMessages = [];
    let selectedMessageId = null;
    let currentUserId = null;
    
    // Connect to Socket.IO for real-time notifications
    const socket = io();
    
    // Handle socket connection
    socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        // Authenticate if we already have user ID
        if (currentUserId) {
            console.log('Authenticating socket with existing user ID:', currentUserId);
            socket.emit('authenticate', currentUserId);
        }
    });
    
    socket.on('authenticated', (data) => {
        console.log('Socket authenticated for user:', data.userId);
    });
    
    socket.on('call-failed', (data) => {
        console.log('Call failed:', data.reason);
        window.notifications.error('Call Failed', data.reason);
        endCall();
    });
    
    // Debug function to check authentication status
    window.checkCallAuth = function() {
        console.log('Current user ID:', currentUserId);
        console.log('Socket connected:', socket.connected);
        console.log('Socket ID:', socket.id);
        
        // Force re-authentication
        if (currentUserId && socket.connected) {
            socket.emit('authenticate', currentUserId);
            console.log('Re-authentication sent');
        }
    };
    
    // Force authentication immediately when currentUserId is available
    function forceAuth() {
        if (currentUserId && socket.connected) {
            console.log('Force authenticating user:', currentUserId);
            socket.emit('authenticate', currentUserId);
        }
    }
    
    // Simple authentication check
    window.ensureAuthenticated = function() {
        if (currentUserId && socket.connected && !socket.authenticated) {
            console.log('Ensuring authentication...');
            socket.emit('authenticate', currentUserId);
        }
    };
    
    // Track authentication status
    socket.on('authenticated', (data) => {
        console.log('Socket authenticated for user:', data.userId);
        socket.authenticated = true;
    });
    
    // Expose force auth function
    window.forceAuth = forceAuth;
    
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
    deleteChatBtn.addEventListener('click', deleteSelectedChats);
    
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
                
                // Authenticate socket connection immediately
                console.log('User ID loaded:', currentUserId);
                authenticateSocket();
            })
            .catch(error => {
                console.error('Authentication error:', error);
            });
    }
    
    // Authenticate socket with retry logic
    function authenticateSocket() {
        if (!currentUserId) {
            console.log('No user ID available for authentication');
            return;
        }
        
        if (socket.connected) {
            console.log('Authenticating socket with user ID:', currentUserId);
            socket.emit('authenticate', currentUserId);
        } else {
            console.log('Socket not connected, waiting...');
            // Wait for socket to connect
            socket.on('connect', () => {
                console.log('Socket connected, authenticating with user ID:', currentUserId);
                socket.emit('authenticate', currentUserId);
            });
        }
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
                <input type="checkbox" class="chat-checkbox" data-person-id="${personId}">
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
            
            // Add event listener to checkbox
            const checkbox = groupHeader.querySelector('.chat-checkbox');
            checkbox.addEventListener('change', updateDeleteButtonVisibility);
            
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
                    <button class="btn-call" data-user-id="${message.sender._id}" data-user-name="${sender}">
                        <i class="fas fa-phone"></i> Call
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
        
        const callBtn = messageView.querySelector('.btn-call');
        if (callBtn) {
            callBtn.addEventListener('click', () => {
                const userId = callBtn.dataset.userId;
                const userName = callBtn.dataset.userName;
                startCall(userId, userName);
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
        
        // Handle temporary users (messages from counters) differently
        if (message.sender.role === 'temporary') {
            // For temporary users, show their email in the To field
            const recipientSelect = document.getElementById('recipient');
            
            // Add a temporary option for this user
            const tempOption = document.createElement('option');
            tempOption.value = message.sender._id;
            tempOption.textContent = `${message.sender.firstName} ${message.sender.lastName} (${message.sender.email})`;
            tempOption.selected = true;
            recipientSelect.appendChild(tempOption);
            
            // Store the email in the hidden field
            document.getElementById('recipientEmail').value = message.sender.email;
        } else {
            // For regular users, select them from the dropdown
            document.getElementById('recipient').value = message.sender._id;
        }
        
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
    
    // Update delete button visibility based on checkbox selection
    function updateDeleteButtonVisibility() {
        const checkedBoxes = document.querySelectorAll('.chat-checkbox:checked');
        if (checkedBoxes.length > 0) {
            deleteChatBtn.style.display = 'block';
        } else {
            deleteChatBtn.style.display = 'none';
        }
    }
    
    // Delete selected chats
    function deleteSelectedChats() {
        const checkedBoxes = document.querySelectorAll('.chat-checkbox:checked');
        if (checkedBoxes.length === 0) return;
        
        const personIds = Array.from(checkedBoxes).map(cb => cb.dataset.personId);
        
        // Create confirmation dialog
        const confirmDialog = document.createElement('div');
        confirmDialog.className = 'custom-confirm';
        confirmDialog.innerHTML = `
            <div class="custom-confirm-content">
                <div class="custom-confirm-header">
                    <h3>Confirm Deletion</h3>
                </div>
                <div class="custom-confirm-body">
                    <p>Are you sure you want to delete ${checkedBoxes.length} chat${checkedBoxes.length > 1 ? 's' : ''}?</p>
                    <p>This will delete all messages in the selected chat${checkedBoxes.length > 1 ? 's' : ''}.</p>
                </div>
                <div class="custom-confirm-footer">
                    <button class="btn-cancel">Cancel</button>
                    <button class="btn-confirm">Delete</button>
                </div>
            </div>
        `;
        document.body.appendChild(confirmDialog);
        
        const cancelBtn = confirmDialog.querySelector('.btn-cancel');
        const confirmBtn = confirmDialog.querySelector('.btn-confirm');
        
        cancelBtn.addEventListener('click', () => {
            confirmDialog.remove();
        });
        
        confirmBtn.addEventListener('click', () => {
            confirmDialog.remove();
            performChatDeletion(personIds);
        });
        
        setTimeout(() => {
            confirmDialog.classList.add('show');
        }, 10);
    }
    
    // Perform the actual chat deletion
    function performChatDeletion(personIds) {
        fetch('/api/messages/delete-chats', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ personIds, folder: currentFolder })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Reload messages
                loadMessages();
                
                // Clear message view
                selectedMessageId = null;
                messageView.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-envelope"></i>
                        <p>Select a message to view</p>
                    </div>
                `;
                
                // Update unread count
                updateUnreadCount();
                
                // Hide delete button
                deleteChatBtn.style.display = 'none';
                
                window.notifications.success('Success', `${personIds.length} chat${personIds.length > 1 ? 's' : ''} deleted successfully`);
            } else {
                window.notifications.error('Error', 'Failed to delete chats');
            }
        })
        .catch(error => {
            console.error('Error deleting chats:', error);
            window.notifications.error('Error', 'Error deleting chats. Please try again.');
        });
    }
    

    
    // Voice call functionality
    let localStream = null;
    let remoteStream = null;
    let peerConnection = null;
    let isCallActive = false;
    let currentCallUserId = null;
    let isSpeakerOn = false;
    let isCallMinimized = false;
    
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };
    
    // Start a voice call
    function startCall(userId, userName) {
        if (isCallActive && !isCallMinimized) {
            window.notifications.error('Call Error', 'A call is already in progress');
            return;
        }
        
        // If there's a minimized call, end it first
        if (isCallMinimized) {
            cleanup();
        }
        
        console.log('Starting call to:', userName);
        currentCallUserId = userId;
        
        navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        })
            .then(stream => {
                console.log('Got local media stream with tracks:', stream.getTracks().map(t => t.kind));
                localStream = stream;
                createPeerConnection();
                
                localStream.getTracks().forEach(track => {
                    console.log('Adding local track:', track.kind, 'enabled:', track.enabled);
                    peerConnection.addTrack(track, localStream);
                });
                
                return peerConnection.createOffer({ offerToReceiveAudio: true });
            })
            .then(offer => {
                console.log('Created offer with audio:', offer.sdp.includes('m=audio'));
                return peerConnection.setLocalDescription(offer);
            })
            .then(() => {
                console.log('Set local description, sending call');
                socket.emit('call-user', {
                    recipientId: userId,
                    callerName: document.getElementById('userName').textContent,
                    offer: peerConnection.localDescription
                });
                
                showCallUI('outgoing', userName);
                isCallActive = true;
            })
            .catch(error => {
                console.error('Error starting call:', error);
                window.notifications.error('Call Error', 'Could not access microphone');
            });
    }
    
    // Create peer connection
    function createPeerConnection() {
        peerConnection = new RTCPeerConnection(configuration);
        
        peerConnection.onicecandidate = event => {
            if (event.candidate && currentCallUserId) {
                socket.emit('ice-candidate', {
                    targetId: currentCallUserId,
                    candidate: event.candidate
                });
            }
        };
        
        peerConnection.ontrack = event => {
            console.log('Received remote track:', event.track.kind, event.streams.length);
            remoteStream = event.streams[0];
            const remoteAudio = document.getElementById('remoteAudio');
            if (remoteAudio) {
                console.log('Setting srcObject for remote audio');
                remoteAudio.srcObject = remoteStream;
                remoteAudio.volume = isSpeakerOn ? 1.0 : 0.7;
                remoteAudio.muted = false;
                
                // Debug stream info
                console.log('Remote stream tracks:', remoteStream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })));
                
                // Set initial audio output device for desktop
                if (remoteAudio.setSinkId && typeof remoteAudio.setSinkId === 'function') {
                    const deviceId = isSpeakerOn ? 'default' : 'communications';
                    remoteAudio.setSinkId(deviceId).catch(e => {
                        console.log('Initial setSinkId failed:', e);
                    });
                }
                
                // Force play after a short delay
                setTimeout(() => {
                    const playPromise = remoteAudio.play();
                    if (playPromise !== undefined) {
                        playPromise.then(() => {
                            console.log('Remote audio started playing successfully');
                        }).catch(e => {
                            console.log('Auto-play failed:', e);
                            remoteAudio.dataset.needsPlay = 'true';
                        });
                    }
                }, 100);
            }
        };
        
        peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', peerConnection.connectionState);
        };
    }
    
    // Show call UI
    function showCallUI(type, userName) {
        const callUI = document.createElement('div');
        callUI.id = 'callUI';
        callUI.className = 'call-ui';
        callUI.innerHTML = `
            <div class="call-container">
                <div class="call-header">
                    <button id="minimizeCall" class="minimize-btn">
                        <i class="fas fa-minus"></i>
                    </button>
                </div>
                <div class="call-info">
                    <div class="call-status">${type === 'incoming' ? 'Incoming call from' : 'Calling'}</div>
                    <div class="call-user">${userName}</div>
                </div>
                <div class="call-controls">
                    ${type === 'incoming' ? `
                        <button id="answerCall" class="call-btn answer">
                            <i class="fas fa-phone"></i>
                        </button>
                        <button id="rejectCall" class="call-btn reject">
                            <i class="fas fa-phone-slash"></i>
                        </button>
                    ` : `
                        <button id="endCall" class="call-btn end">
                            <i class="fas fa-phone-slash"></i>
                        </button>
                    `}
                </div>
                <audio id="remoteAudio" autoplay playsinline controls style="width:100%; margin-top:10px;"></audio>
            </div>
        `;
        
        document.body.appendChild(callUI);
        
        // Add event listeners
        const answerBtn = document.getElementById('answerCall');
        const rejectBtn = document.getElementById('rejectCall');
        const endBtn = document.getElementById('endCall');
        const minimizeBtn = document.getElementById('minimizeCall');
        
        if (answerBtn) {
            answerBtn.addEventListener('click', answerCall);
        }
        
        if (rejectBtn) {
            rejectBtn.addEventListener('click', endCall);
        }
        
        if (endBtn) {
            endBtn.addEventListener('click', endCall);
        }
        
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', minimizeCall);
        }
    }
    
    // Answer incoming call
    function answerCall() {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                localStream = stream;
                
                // Add local tracks to peer connection
                localStream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, localStream);
                });
                
                // Create answer after adding tracks
                return peerConnection.createAnswer();
            })
            .then(answer => {
                return peerConnection.setLocalDescription(answer);
            })
            .then(() => {
                socket.emit('answer-call', {
                    callerId: currentCallUserId,
                    answer: peerConnection.localDescription
                });
                
                updateCallUI('connected');
                
                // Mobile audio fix - ensure remote audio plays after user interaction
                setTimeout(() => {
                    const remoteAudio = document.getElementById('remoteAudio');
                    if (remoteAudio && remoteAudio.srcObject) {
                        remoteAudio.play().catch(e => console.log('Remote audio play failed:', e));
                    }
                }, 500);
            })
            .catch(error => {
                console.error('Error answering call:', error);
                endCall();
            });
    }
    
    // Minimize call
    function minimizeCall() {
        const callUI = document.getElementById('callUI');
        if (callUI) {
            callUI.style.display = 'none';
            isCallMinimized = true;
            showMinimizedCallIndicator();
        }
    }
    
    // Show minimized call indicator
    function showMinimizedCallIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'minimizedCallIndicator';
        indicator.className = 'minimized-call-indicator';
        indicator.innerHTML = `
            <i class="fas fa-phone"></i>
            <span>Call in progress</span>
        `;
        makeDraggable(indicator);
        document.body.appendChild(indicator);
    }
    
    // Make element draggable
    function makeDraggable(element) {
        let isDragging = false;
        let hasDragged = false;
        let startX, startY, initialX, initialY;
        
        element.addEventListener('mousedown', (e) => {
            isDragging = true;
            hasDragged = false;
            startX = e.clientX;
            startY = e.clientY;
            initialX = element.offsetLeft;
            initialY = element.offsetTop;
            element.style.cursor = 'grabbing';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                
                if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
                    hasDragged = true;
                    element.style.left = (initialX + deltaX) + 'px';
                    element.style.top = (initialY + deltaY) + 'px';
                    element.style.right = 'auto';
                }
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                element.style.cursor = 'pointer';
                
                if (!hasDragged) {
                    restoreCall();
                }
            }
        });
    }
    
    // Restore call from minimized state
    function restoreCall() {
        const callUI = document.getElementById('callUI');
        const indicator = document.getElementById('minimizedCallIndicator');
        
        if (callUI) {
            callUI.style.display = 'flex';
        }
        
        if (indicator) {
            indicator.remove();
        }
        
        isCallMinimized = false;
    }
    
    // Update call UI
    function updateCallUI(status) {
        const callStatus = document.querySelector('.call-status');
        const callControls = document.querySelector('.call-controls');
        
        if (callStatus) {
            callStatus.textContent = status === 'connected' ? 'Connected' : 'Calling...';
        }
        
        if (callControls && status === 'connected') {
            callControls.innerHTML = `
                <button id="toggleSpeaker" class="call-btn speaker ${isSpeakerOn ? 'active' : ''}">
                    <i class="fas fa-volume-up"></i>
                </button>
                <button id="endCall" class="call-btn end">
                    <i class="fas fa-phone-slash"></i>
                </button>
            `;
            
            document.getElementById('toggleSpeaker').addEventListener('click', toggleSpeaker);
            document.getElementById('endCall').addEventListener('click', endCall);
        }
    }
    
    // End call
    function endCall() {
        if (currentCallUserId) {
            socket.emit('end-call', { targetId: currentCallUserId });
        }
        
        cleanup();
    }
    
    // Toggle speaker mode
    function toggleSpeaker() {
        const remoteAudio = document.getElementById('remoteAudio');
        const speakerBtn = document.getElementById('toggleSpeaker');
        
        if (remoteAudio) {
            isSpeakerOn = !isSpeakerOn;
            
            // Ensure audio is playing (mobile fix)
            if (remoteAudio.dataset.needsPlay === 'true') {
                remoteAudio.play().then(() => {
                    remoteAudio.dataset.needsPlay = 'false';
                }).catch(e => console.log('Play failed:', e));
            }
            
            // Desktop/Laptop: Use setSinkId for audio output device selection
            if (remoteAudio.setSinkId && typeof remoteAudio.setSinkId === 'function') {
                // Try to set to default speakers when speaker mode is on
                const deviceId = isSpeakerOn ? 'default' : 'communications';
                remoteAudio.setSinkId(deviceId)
                    .then(() => {
                        console.log(`Audio output set to: ${isSpeakerOn ? 'speakers' : 'communications'}`);
                    })
                    .catch(e => {
                        console.log('setSinkId failed, using volume control:', e);
                        // Fallback to volume control if setSinkId fails
                    });
            }
            
            // Update volume for speaker mode (higher for speakers, lower for headphones)
            remoteAudio.volume = isSpeakerOn ? 1.0 : 0.7;
            
            // Force audio context resume (for some browsers)
            if (window.AudioContext || window.webkitAudioContext) {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                if (audioContext.state === 'suspended') {
                    audioContext.resume().then(() => {
                        console.log('Audio context resumed');
                    });
                }
            }
            
            // Update button appearance
            if (speakerBtn) {
                speakerBtn.classList.toggle('active', isSpeakerOn);
                speakerBtn.innerHTML = `<i class="fas fa-volume-${isSpeakerOn ? 'up' : 'down'}"></i>`;
                speakerBtn.title = isSpeakerOn ? 'Switch to Headphones' : 'Switch to Speakers';
            }
            
            // Visual feedback
            window.notifications?.info('Audio Output', 
                isSpeakerOn ? 'Switched to Speakers' : 'Switched to Headphones/Earpiece'
            );
        }
    }
    
    // Cleanup call resources
    function cleanup() {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        
        const callUI = document.getElementById('callUI');
        const indicator = document.getElementById('minimizedCallIndicator');
        
        if (callUI) {
            callUI.remove();
        }
        
        if (indicator) {
            indicator.remove();
        }
        
        isCallActive = false;
        currentCallUserId = null;
        remoteStream = null;
        isSpeakerOn = false;
        isCallMinimized = false;
    }
    
    // Socket event handlers for voice calls
    socket.on('incoming-call', (data) => {
        if (isCallActive && !isCallMinimized) {
            socket.emit('call-failed', { reason: 'User is busy' });
            return;
        }
        
        // If there's a minimized call, end it first
        if (isCallMinimized) {
            cleanup();
        }
        
        console.log('Incoming call from:', data.callerName);
        currentCallUserId = data.callerId;
        createPeerConnection();
        
        peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
            .then(() => {
                console.log('Remote description set for incoming call');
                showCallUI('incoming', data.callerName);
                isCallActive = true;
                isCallMinimized = false;
            })
            .catch(error => {
                console.error('Error handling incoming call:', error);
                endCall();
            });
    });
    
    socket.on('call-answered', (data) => {
        console.log('Call answered, setting remote description');
        peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
            .then(() => {
                console.log('Remote description set for answer');
                updateCallUI('connected');
            })
            .catch(error => {
                console.error('Error handling call answer:', error);
                endCall();
            });
    });
    
    socket.on('ice-candidate', (candidate) => {
        if (peerConnection && peerConnection.remoteDescription) {
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                .catch(error => {
                    console.error('Error adding ICE candidate:', error);
                });
        } else {
            console.log('Queuing ICE candidate until remote description is set');
            // Queue the candidate for later if remote description isn't set yet
            setTimeout(() => {
                if (peerConnection && peerConnection.remoteDescription) {
                    peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                        .catch(error => {
                            console.error('Error adding queued ICE candidate:', error);
                        });
                }
            }, 1000);
        }
    });
    
    socket.on('call-ended', () => {
        console.log('Call ended by other party');
        cleanup();
    });
    
    socket.on('call-ended-disconnect', (data) => {
        if (data.userId === currentCallUserId) {
            console.log('Call ended due to disconnect');
            cleanup();
        }
    });
    
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