document.addEventListener('DOMContentLoaded', function() {
    // Fetch user info
    fetchUserInfo();
    
    // Fetch statistics
    fetchStats();
    
    // Refresh stats every 30 seconds
    setInterval(fetchStats, 30000);
    
    // Setup accordion functionality
    setupAccordions();
    
    // Check URL parameters
    handleUrlParameters();
    
    // Setup logout button
    setupLogoutButton();
    
    // Setup display screen badge
    setupDisplayScreenBadge();
});

// Handle logout button click
function setupLogoutButton() {
    const logoutLink = document.querySelector('a.header-logout-btn');
    
    if (logoutLink) {
        logoutLink.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Show loading state
            this.innerHTML = '<img src="images/logout.jpg" alt="Logout" class="logout-icon"> Logging out...';
            this.style.opacity = '0.7';
            this.style.pointerEvents = 'none';
            
            // Redirect to logout URL
            window.location.href = '/api/auth/logout';
        });
    }
}

// No longer needed - display screen is now an accordion section

// Initialize display screen (no need for separate function now)

// Show display screen and scroll to it
function showDisplayScreen() {
    const displaySection = document.getElementById('displayScreenSection');
    
    if (displaySection) {
        // Show the section
        displaySection.classList.add('active');
        
        // Wait a moment for the display to become visible before scrolling
        setTimeout(() => {
            displaySection.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }
}

// Accordion functionality
function setupAccordions() {
    const accordionSections = document.querySelectorAll('.accordion-section');
    let hoverTimer = null;
    
    accordionSections.forEach(section => {
        const header = section.querySelector('.accordion-header');
        
        // Click handler
        header.addEventListener('click', () => {
            // Clear any pending hover timer
            if (hoverTimer) {
                clearTimeout(hoverTimer);
                hoverTimer = null;
            }
            
            // Toggle active class on the clicked section
            section.classList.toggle('active');
            
            // Hide sidebar toggle when display screen is active
            if (section.id === 'displayScreenSection') {
                const sidebarToggle = document.querySelector('.sidebar-toggle');
                if (sidebarToggle) {
                    if (section.classList.contains('active')) {
                        sidebarToggle.style.display = 'none';
                    } else {
                        sidebarToggle.style.display = 'flex';
                    }
                }
            }
            
            // If this is the ticket history section and it's being opened, load the iframe
            if (section.id === 'ticketHistorySection' && section.classList.contains('active')) {
                const iframe = section.querySelector('iframe');
                if (iframe && !iframe.getAttribute('src')) {
                    iframe.setAttribute('src', '/history');
                }
            }
        });
        
        // Hover handlers for auto-open
        header.addEventListener('mouseenter', () => {
            // Only set timer if section is not already active
            if (!section.classList.contains('active')) {
                hoverTimer = setTimeout(() => {
                    section.classList.add('active');
                    
                    // Load iframe if needed
                    if (section.id === 'ticketHistorySection') {
                        const iframe = section.querySelector('iframe');
                        if (iframe && !iframe.getAttribute('src')) {
                            iframe.setAttribute('src', '/history');
                        }
                    }
                }, 2000);
            }
        });
        
        header.addEventListener('mouseleave', () => {
            // Clear timer when mouse leaves
            if (hoverTimer) {
                clearTimeout(hoverTimer);
                hoverTimer = null;
            }
        });
    });
}

async function fetchUserInfo() {
    try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        
        // If the user has a counter, ensure it's properly set in the Counter model
        if (data.user && data.user.counter) {
            try {
                await fetch('/api/notify-counter-update', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({})
                });
            } catch (error) {
                // Silent error handling
            }
        }
        
        if (response.ok && data.user) {
            const userNameElement = document.getElementById('userName');
            userNameElement.textContent = `${data.user.firstName} ${data.user.lastName}`;
            document.getElementById('userRole').textContent = data.user.role;
            
            // No longer displaying counter information in the header
            
            // Customize sidebar based on user role
            if (data.user.role !== 'admin') {
                // Hide the h2 element completely for non-admin users
                const sidebarHeader = document.querySelector('.sidebar-header h2');
                if (sidebarHeader) {
                    sidebarHeader.style.display = 'none';
                }
            }
            
            if (data.user.role === 'supervisor') {
                // Set supervisor role without read-only indicator
                const roleElement = document.getElementById('userRole');
                roleElement.textContent = 'supervisor';
                roleElement.style.backgroundColor = '#fd7e14';
                
                // Hide any signup links (create user)
                const signupLinks = document.querySelectorAll('.sidebar-nav a[href="/signup"]');
                signupLinks.forEach(link => {
                    // Hide the entire list item, not just the link
                    const listItem = link.closest('li');
                    if (listItem) {
                        listItem.style.display = 'none';
                    }
                });
                
                // Change "Manage Users" to "Users"
                const usersLink = document.querySelector('a[href="/users"]');
                if (usersLink) {
                    // Find the span element that contains the text
                    const spanElement = usersLink.querySelector('span');
                    if (spanElement) {
                        spanElement.textContent = ' Users';
                    }
                }
            } else if (data.user.role === 'employee') {
                // Add an employee indicator
                const roleElement = document.getElementById('userRole');
                roleElement.textContent = 'employee';
                roleElement.style.backgroundColor = '#20c997';
                
                // Hide only signup links, keep users link visible
                const signupLinks = document.querySelectorAll('.sidebar-nav a[href="/signup"]');
                signupLinks.forEach(link => {
                    const listItem = link.closest('li');
                    if (listItem) {
                        listItem.style.display = 'none';
                    }
                });
                
                // Change "Manage Users" to "Users"
                const usersLink = document.querySelector('a[href="/users"]');
                if (usersLink) {
                    // Find the span element that contains the text
                    const spanElement = usersLink.querySelector('span');
                    if (spanElement) {
                        spanElement.textContent = ' Users';
                    }
                }
            }
        } else {
            // If not authenticated, redirect to login
            window.location.href = '/login';
        }
    } catch (error) {
        // Error handling without logging
    }
}

async function fetchStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        if (response.ok) {
            // Update statistics
            document.getElementById('totalTickets').textContent = data.totalTickets;
            document.getElementById('waitingTickets').textContent = data.waitingTickets;
            document.getElementById('servingTickets').textContent = data.servingTickets;
            document.getElementById('completedTickets').textContent = data.completedTickets;
            document.getElementById('avgWaitTime').textContent = data.avgWaitTime;
            document.getElementById('avgServiceTime').textContent = data.avgServiceTime;
            
            // Update service distribution chart
            updateServiceDistribution(data.serviceDistribution);
        }
    } catch (error) {
        // Error handling without logging
    }
}

function updateServiceDistribution(distribution) {
    const container = document.getElementById('serviceDistribution');
    container.innerHTML = '';
    
    // Find the maximum count for scaling
    const maxCount = Math.max(...distribution.map(item => item.count));
    
    // Sort by count (descending)
    distribution.sort((a, b) => b.count - a.count);
    
    // Create bars for each service
    distribution.forEach(item => {
        const percentage = (item.count / maxCount) * 100;
        
        const chartBar = document.createElement('div');
        chartBar.className = 'chart-bar';
        
        chartBar.innerHTML = `
            <div class="chart-label">${item._id}</div>
            <div class="chart-bar-container">
                <div class="chart-bar-fill" style="width: ${percentage}%"></div>
            </div>
            <div class="chart-value">${item.count}</div>
        `;
        
        container.appendChild(chartBar);
    });
    
    // If no data
    if (distribution.length === 0) {
        container.innerHTML = '<p>No data available</p>';
    }
}

// Helper function to get counter name from counter number
function getCounterName(counterNumber) {
    const counterNames = {
        '1': 'Account Opening',
        '2': 'Loan Application',
        '3': 'Money Transfer',
        '4': 'Card Services',
        '5': 'General Inquiry'
    };
    
    return counterNames[counterNumber] || 'Unknown';
}

// Handle URL parameters to show specific sections
function handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const section = urlParams.get('section');
    
    if (section === 'history') {
        // Open history section
        const historySection = document.getElementById('ticketHistorySection');
        if (historySection) {
            historySection.classList.add('active');
            setTimeout(() => {
                historySection.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    } else if (section === 'display') {
        // Show display screen
        const displaySection = document.getElementById('displayScreenSection');
        if (displaySection) {
            displaySection.classList.add('active');
            setTimeout(() => {
                displaySection.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    } else if (section === 'connected-users') {
        // Show connected users section
        const connectedUsersSection = document.getElementById('connectedUsersSection');
        if (connectedUsersSection) {
            // Load connected users
            if (typeof loadConnectedUsers === 'function') {
                loadConnectedUsers();
            }
            
            // Activate the section
            document.querySelectorAll('.accordion-section').forEach(section => {
                section.classList.remove('active');
            });
            connectedUsersSection.classList.add('active');
            
            // Scroll to the section
            setTimeout(() => {
                connectedUsersSection.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    }
}

// Display Screen Badge Management
function setupDisplayScreenBadge() {
    const displayScreenBadge = document.getElementById('displayScreenBadge');
    const displayScreenSection = document.getElementById('displayScreenSection');
    
    if (!displayScreenBadge || !displayScreenSection) {
        return;
    }
    
    // Function to check if display screen is folded
    function isDisplayScreenFolded() {
        return !displayScreenSection.classList.contains('active');
    }
    
    // Function to update the badge
    function updateDisplayScreenBadge(count) {
        if (count > 0) {
            displayScreenBadge.textContent = count > 99 ? '99+' : count;
            displayScreenBadge.style.display = 'inline-block';
        } else {
            displayScreenBadge.style.display = 'none';
        }
    }
    
    // Function to hide the badge
    function hideDisplayScreenBadge() {
        displayScreenBadge.style.display = 'none';
    }
    
    // Check for unread messages and update badge
    async function checkUnreadMessages() {
        try {
            const response = await fetch('/api/messages/unread');
            if (!response.ok) {
                // If endpoint doesn't exist, hide badge
                hideDisplayScreenBadge();
                return;
            }
            
            const data = await response.json();
            const unreadCount = data.unreadCount || 0;
            
            updateDisplayScreenBadge(unreadCount);
        } catch (error) {
            // If there's an error (like endpoint not found), hide the badge
            hideDisplayScreenBadge();
        }
    }
    
    // Listen for display screen accordion toggle
    const displayScreenHeader = displayScreenSection.querySelector('.accordion-header');
    if (displayScreenHeader) {
        const handleToggle = function() {
            // Always check for messages when toggling, don't hide badge
            setTimeout(checkUnreadMessages, 350);
        };
        
        displayScreenHeader.addEventListener('click', handleToggle);
        displayScreenHeader.addEventListener('touchend', handleToggle);
    }
    
    // Listen for new message events from socket
    if (typeof socket !== 'undefined') {
        socket.on('newMessage', function(data) {
            // Update badge when new message arrives
            setTimeout(checkUnreadMessages, 100);
        });
    }
    
    // Listen for messages from the display screen iframe
    window.addEventListener('message', function(event) {
        if (event.data.type === 'newMessageForBadge') {
            // Update badge when new message arrives from iframe
            setTimeout(checkUnreadMessages, 100);
        }
    });
    
    // Check for unread messages every 10 seconds
    setInterval(checkUnreadMessages, 10000);
    
    // Initial check
    setTimeout(checkUnreadMessages, 1000);
    
    // Listen for window resize to handle mobile responsiveness
    window.addEventListener('resize', function() {
        setTimeout(checkUnreadMessages, 100);
    });
}