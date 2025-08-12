let callLogsData = [];

document.addEventListener('DOMContentLoaded', function() {
    // Fetch user info
    fetchUserInfo();
    
    // Load call logs
    loadCallLogs();
    
    // Setup delete selected button
    document.getElementById('deleteSelectedBtn').addEventListener('click', deleteSelectedLogs);
    
    // Client-side call logging removed - using database only
});

async function fetchUserInfo() {
    try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        
        if (response.ok && data.user) {
            document.getElementById('userName').textContent = `${data.user.firstName} ${data.user.lastName}`;
            document.getElementById('userRole').textContent = data.user.role;
            
            // Hide admin panel text for non-admin users
            if (data.user.role !== 'admin') {
                const sidebarHeader = document.querySelector('.sidebar-header h2');
                if (sidebarHeader) {
                    sidebarHeader.style.display = 'none';
                }
            }
            
            // Hide signup links for non-admin users
            if (data.user.role !== 'admin') {
                const signupLinks = document.querySelectorAll('.sidebar-nav a[href="/signup"]');
                signupLinks.forEach(link => {
                    const listItem = link.closest('li');
                    if (listItem) {
                        listItem.style.display = 'none';
                    }
                });
                
                // Change "Manage Users" to "Users" for non-admin
                const usersLink = document.querySelector('a[href="/users"]');
                if (usersLink) {
                    const spanElement = usersLink.querySelector('span');
                    if (spanElement) {
                        spanElement.textContent = ' Users';
                    }
                }
            }
        } else {
            window.location.href = '/login';
        }
    } catch (error) {
        window.location.href = '/login';
    }
}

async function loadCallLogs() {
    try {
        // Get real call logs from database
        const callResponse = await fetch('/api/call-logs');
        const callData = await callResponse.json();
        
        if (callResponse.ok && callData.calls) {
            // Get current user info to determine call direction
            const userResponse = await fetch('/api/auth/me');
            const userData = await userResponse.json();
            const currentUserId = userData.user._id;
            
            // Transform database calls to display format - avoid duplicates
            const seenCallIds = new Set();
            const transformedCalls = callData.calls
                .filter(call => {
                    if (seenCallIds.has(call._id.toString())) {
                        return false;
                    }
                    seenCallIds.add(call._id.toString());
                    return true;
                })
                .map(call => {
                    const isOutgoing = call.callerId._id === currentUserId;
                    const contactName = isOutgoing ? call.recipientName : call.callerName;
                    const callType = call.status === 'declined' ? 'missed' : (isOutgoing ? 'outgoing' : 'incoming');
                    
                    return {
                        id: call._id,
                        type: callType,
                        contact: contactName,
                        counter: 'Voice Call',
                        duration: call.status === 'declined' ? null : (call.duration > 0 ? formatDuration(call.duration) : (call.status === 'answered' || call.status === 'ended' ? '0:00' : null)),
                        timestamp: new Date(call.createdAt),
                        callDate: formatCallDate(new Date(call.createdAt)),
                        callTime: formatCallTime(new Date(call.createdAt))
                    };
                });
            
            callLogsData = transformedCalls;
            displayCallLogs(transformedCalls);
        } else {
            callLogsData = [];
            displayCallLogs([]);
        }
    } catch (error) {
        callLogsData = [];
        displayCallLogs([]);
    }
}

function displayCallLogs(callLogs) {
    const callLogsList = document.getElementById('callLogsList');
    
    if (callLogs.length === 0) {
        callLogsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-phone"></i>
                <p>No call logs available</p>
            </div>
        `;
        return;
    }
    
    callLogsList.innerHTML = '';
    
    callLogs.forEach(log => {
        const logItem = document.createElement('div');
        logItem.className = 'call-log-item';
        
        const directionIcon = getDirectionIcon(log.type);
        const durationText = log.duration || 'Missed';
        const timeText = formatTime(log.timestamp);
        
        logItem.innerHTML = `
            <input type="checkbox" class="call-log-checkbox" data-id="${log.id}">
            <button class="call-log-delete" onclick="deleteSingleLog('${log.id}')">
                <i class="fas fa-trash"></i>
            </button>
            <div class="call-direction ${log.type}">
                ${directionIcon}
            </div>
            <div class="call-info">
                <div class="call-contact">${log.contact}</div>
                <div class="call-details">${log.counter}</div>
                <div class="call-datetime">${log.callDate} at ${log.callTime}</div>
            </div>
            <div class="call-duration ${log.type === 'missed' ? 'missed' : ''}">
                Duration: ${durationText}
            </div>
        `;
        
        // Add checkbox change listener
        const checkbox = logItem.querySelector('.call-log-checkbox');
        checkbox.addEventListener('change', updateDeleteButton);
        
        callLogsList.appendChild(logItem);
    });
}

function getDirectionIcon(type) {
    switch (type) {
        case 'incoming':
            return '<i class="fas fa-arrow-down"></i>';
        case 'outgoing':
            return '<i class="fas fa-arrow-up"></i>';
        case 'missed':
            return '<i class="fas fa-phone-slash"></i>';
        default:
            return '<i class="fas fa-phone"></i>';
    }
}

function formatTime(timestamp) {
    const now = new Date();
    const diff = now - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) {
        const minutes = Math.floor(diff / (1000 * 60));
        return `${minutes} min ago`;
    } else if (hours < 24) {
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
        return timestamp.toLocaleDateString();
    }
}

async function deleteSingleLog(logId) {
    try {
        const response = await fetch(`/api/call-logs/${logId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            callLogsData = callLogsData.filter(log => log.id !== logId);
            displayCallLogs(callLogsData);
        }
    } catch (error) {
        console.error('Error deleting call log:', error);
    }
}

async function deleteSelectedLogs() {
    const selectedIds = Array.from(document.querySelectorAll('.call-log-checkbox:checked'))
        .map(checkbox => checkbox.dataset.id);
    
    try {
        const response = await fetch('/api/call-logs', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ids: selectedIds })
        });
        
        if (response.ok) {
            callLogsData = callLogsData.filter(log => !selectedIds.includes(log.id));
            displayCallLogs(callLogsData);
        }
    } catch (error) {
        console.error('Error deleting call logs:', error);
    }
}

// Removed localStorage-based delete functions - now using database

// Client-side call logging functions removed - using database only

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatCallDate(date) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString();
    }
}

function formatCallTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function updateDeleteButton() {
    const selectedCount = document.querySelectorAll('.call-log-checkbox:checked').length;
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    
    if (selectedCount > 0) {
        deleteBtn.style.display = 'block';
        deleteBtn.textContent = `Delete Selected (${selectedCount})`;
    } else {
        deleteBtn.style.display = 'none';
    }
}