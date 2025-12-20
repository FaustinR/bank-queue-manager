// Store all tickets for client-side filtering
let allTickets = [];

// Store counter staff information
window.counterStaff = {};

// Initialize socket connection if available
let socket;
if (typeof io !== 'undefined') {
    socket = io();
    
    // Listen for queue updates to refresh ticket history
    socket.on('queueUpdate', async function(data) {
        // Update counter staff from the data if available
        if (data && data.counterStaff) {
            window.counterStaff = data.counterStaff;
        } else {
            // Otherwise fetch it
            await fetchCounterStaff();
        }
        fetchTicketHistory();
    });
    
    // Listen for specific ticket updates
    socket.on('ticketUpdated', async function() {
        await fetchCounterStaff();
        fetchTicketHistory();
    });
}

// Function to fetch counter staff information
async function fetchCounterStaff() {
    try {
        const response = await fetch('/api/counters/staff');
        if (response.ok) {
            const data = await response.json();
            window.counterStaff = data.counterStaff || {};
        }
    } catch (error) {
        // Error fetching counter staff
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Check if page is in an iframe
    if (window.self !== window.top) {
        // We're in an iframe
        document.body.classList.add('embedded-history');
    }
    
    // Load all data simultaneously
    Promise.all([checkAdminStatus(), fetchCounterStaff()]).then(() => {
        fetchTicketHistory();
    });
    
    // Set up auto-refresh every 30 seconds
    const refreshInterval = setInterval(async () => {
        await fetchCounterStaff();
        fetchTicketHistory();
    }, 30000);
    
    // Clean up interval when page is unloaded
    window.addEventListener('beforeunload', function() {
        clearInterval(refreshInterval);
    });
    
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.addEventListener('click', async function() {
        // Add active class to show button is clicked
        refreshBtn.classList.add('active');
        
        // Clear all filters first
        clearAllFilters();
        
        // Fetch data
        await fetchCounterStaff();
        fetchTicketHistory();
        
        // Remove active class after a short delay
        setTimeout(() => {
            refreshBtn.classList.remove('active');
        }, 500);
    });
    
    document.getElementById('filterForm').addEventListener('submit', function(e) {
        e.preventDefault();
        fetchTicketHistory();
    });
    
    // Set up column filters
    setupColumnFilters();
    
    // Set up sortable columns
    setupSortableColumns();
    
    // Set up delete functionality
    setupDeleteFunctionality();
});

// Check if user is admin
async function checkAdminStatus() {
    try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
            const data = await response.json();
            if (data.user && data.user.role === 'admin') {
                // Show admin controls
                document.getElementById('admin-controls').style.display = 'table-cell';
                document.getElementById('admin-actions').style.display = 'table-cell';
                document.getElementById('deleteActions').style.display = 'block';
            }
        }
    } catch (error) {
        // Not admin or error
    }
}

// Set up delete functionality
function setupDeleteFunctionality() {
    // Select all checkbox
    document.getElementById('selectAll').addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('.ticket-checkbox');
        checkboxes.forEach(cb => cb.checked = this.checked);
        updateDeleteButton();
    });
    
    // Delete selected button
    document.getElementById('deleteSelectedBtn').addEventListener('click', function() {
        const selectedIds = getSelectedTicketIds();
        if (selectedIds.length > 0) {
            showDeleteModal(selectedIds, selectedIds.length > 1);
        }
    });
}

// Get selected ticket IDs
function getSelectedTicketIds() {
    const checkboxes = document.querySelectorAll('.ticket-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.dataset.ticketId);
}

// Update delete button state
function updateDeleteButton() {
    const selectedCount = document.querySelectorAll('.ticket-checkbox:checked').length;
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    deleteBtn.textContent = selectedCount > 0 ? `Delete Selected (${selectedCount})` : 'Delete Selected';
    deleteBtn.disabled = selectedCount === 0;
}

// Delete tickets
async function deleteTickets(ticketIds) {
    try {
        const response = await fetch('/api/tickets/delete', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ticketIds })
        });
        
        if (response.ok) {
            window.notifications.success('Success', `${ticketIds.length} ticket(s) deleted successfully`);
            // Refresh the ticket list
            await fetchCounterStaff();
            fetchTicketHistory();
            // Reset select all checkbox
            document.getElementById('selectAll').checked = false;
        } else {
            const error = await response.text();
            window.notifications.error('Error', `Failed to delete tickets: ${error}`);
        }
    } catch (error) {
        window.notifications.error('Error', 'Failed to delete tickets');
    }
}

// Delete single ticket
function deleteSingleTicket(ticketId) {
    showDeleteModal([ticketId], false);
}

// Global variable to store tickets to delete
let ticketsToDelete = [];

// Show delete confirmation modal
function showDeleteModal(ticketIds, isMultiple) {
    ticketsToDelete = ticketIds;
    const message = isMultiple ? 
        `Are you sure you want to delete ${ticketIds.length} tickets?` : 
        'Are you sure you want to delete this ticket?';
    document.getElementById('deleteMessage').textContent = message;
    const modal = document.getElementById('deleteModal');
    modal.style.display = 'block';
    makeDraggable(modal);
}

// Close delete modal
function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
    ticketsToDelete = [];
}

// Make modal draggable
function makeDraggable(modal) {
    const modalContent = modal.querySelector('.modal-content');
    const header = modal.querySelector('.modal-header');
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;
    
    header.addEventListener('mousedown', dragStart);
    header.addEventListener('touchstart', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag);
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchend', dragEnd);
    
    function dragStart(e) {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        initialX = clientX - xOffset;
        initialY = clientY - yOffset;
        
        if (e.target === header || header.contains(e.target)) {
            isDragging = true;
            modalContent.style.margin = '0';
            modalContent.style.position = 'absolute';
        }
    }
    
    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            currentX = clientX - initialX;
            currentY = clientY - initialY;
            xOffset = currentX;
            yOffset = currentY;
            
            modalContent.style.transform = `translate(${currentX}px, ${currentY}px)`;
        }
    }
    
    function dragEnd() {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
    }
}

// Confirm delete action
async function confirmDelete() {
    if (ticketsToDelete.length > 0) {
        await deleteTickets(ticketsToDelete);
        closeDeleteModal();
    }
}

function setupColumnFilters() {
    // Ticket number filter
    document.getElementById('ticketNumberFilter').addEventListener('input', function() {
        filterTickets();
    });
    
    // Customer filter
    document.getElementById('customerFilter').addEventListener('input', function() {
        filterTickets();
    });
    
    // Service filter
    document.getElementById('serviceColumnFilter').addEventListener('input', function() {
        filterTickets();
    });
    
    // Counter filter
    document.getElementById('counterFilter').addEventListener('input', function() {
        filterTickets();
    });
    
    // Teller filter
    document.getElementById('tellerFilter').addEventListener('input', function() {
        filterTickets();
    });
    
    // Status filter
    document.getElementById('statusColumnFilter').addEventListener('input', function() {
        filterTickets();
    });
    
    // Created date filter
    document.getElementById('createdFilter').addEventListener('input', function() {
        filterTickets();
    });
}

function setupSortableColumns() {
    const sortableColumns = document.querySelectorAll('th.sortable');
    sortableColumns.forEach(column => {
        column.addEventListener('click', function() {
            // Get column index
            const columnIndex = Array.from(column.parentNode.children).indexOf(column);
            
            // Toggle sort direction
            if (column.classList.contains('sort-asc')) {
                // Currently ascending, switch to descending
                sortableColumns.forEach(col => col.classList.remove('sort-asc', 'sort-desc'));
                column.classList.add('sort-desc');
                sortTickets(columnIndex, 'desc');
            } else if (column.classList.contains('sort-desc')) {
                // Currently descending, remove sorting
                sortableColumns.forEach(col => col.classList.remove('sort-asc', 'sort-desc'));
                displayTickets(allTickets); // Reset to original order
            } else {
                // Not sorted, sort ascending
                sortableColumns.forEach(col => col.classList.remove('sort-asc', 'sort-desc'));
                column.classList.add('sort-asc');
                sortTickets(columnIndex, 'asc');
            }
        });
    });
}

function sortTickets(columnIndex, direction) {
    const sortedTickets = [...allTickets];
    
    sortedTickets.sort((a, b) => {
        let valueA, valueB;
        
        // Extract values based on column index
        switch(columnIndex) {
            case 0: // Ticket #
                valueA = a.ticketNumber;
                valueB = b.ticketNumber;
                break;
            case 1: // Customer
                valueA = a.customerName.toLowerCase();
                valueB = b.customerName.toLowerCase();
                break;
            case 2: // Service
                valueA = (a.customService && a.customService !== a.service) ? 
                    a.customService.toLowerCase() : a.service.toLowerCase();
                valueB = (b.customService && b.customService !== b.service) ? 
                    b.customService.toLowerCase() : b.service.toLowerCase();
                break;
            case 3: // Counter
                valueA = a.counterId || 0;
                valueB = b.counterId || 0;
                break;
            case 4: // Teller
                valueA = a.tellerName ? a.tellerName.toLowerCase() : 
                    (window.counterStaff && window.counterStaff[a.counterId] ? 
                    window.counterStaff[a.counterId].toLowerCase() : '-');
                valueB = b.tellerName ? b.tellerName.toLowerCase() : 
                    (window.counterStaff && window.counterStaff[b.counterId] ? 
                    window.counterStaff[b.counterId].toLowerCase() : '-');
                break;
            case 5: // Status
                valueA = a.status.toLowerCase();
                valueB = b.status.toLowerCase();
                break;
            case 6: // Created
                valueA = new Date(a.createdAt);
                valueB = new Date(b.createdAt);
                break;
            default:
                return 0;
        }
        
        // Compare values based on direction
        if (direction === 'asc') {
            return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
        } else {
            return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
        }
    });
    
    displayTickets(sortedTickets);
}

// Clear all filters including main filters and column filters
function clearAllFilters() {
    // Clear main filters
    document.getElementById('statusFilter').value = '';
    document.getElementById('serviceFilter').value = '';
    document.getElementById('dateFilter').value = '';
    
    // Clear column filters
    document.getElementById('ticketNumberFilter').value = '';
    document.getElementById('customerFilter').value = '';
    document.getElementById('serviceColumnFilter').value = '';
    document.getElementById('counterFilter').value = '';
    document.getElementById('tellerFilter').value = '';
    document.getElementById('statusColumnFilter').value = '';
    document.getElementById('createdFilter').value = '';
}

function filterTickets() {
    // Get filter values
    const ticketNumberFilter = document.getElementById('ticketNumberFilter').value.toLowerCase();
    const customerFilter = document.getElementById('customerFilter').value.toLowerCase();
    const serviceFilter = document.getElementById('serviceColumnFilter').value.toLowerCase();
    const counterFilter = document.getElementById('counterFilter').value.toLowerCase();
    const tellerFilter = document.getElementById('tellerFilter').value.toLowerCase();
    const statusFilter = document.getElementById('statusColumnFilter').value.toLowerCase();
    const createdFilter = document.getElementById('createdFilter').value.toLowerCase();
    
    // Start with all tickets
    let filteredTickets = [...allTickets];
    
    // Apply filters one by one
    
    // Filter by ticket number
    if (ticketNumberFilter) {
        filteredTickets = filteredTickets.filter(ticket => 
            String(ticket.ticketNumber).includes(ticketNumberFilter));
    }
    
    // Filter by customer name
    if (customerFilter) {
        filteredTickets = filteredTickets.filter(ticket => 
            ticket.customerName.toLowerCase().includes(customerFilter));
    }
    
    // Filter by service
    if (serviceFilter) {
        filteredTickets = filteredTickets.filter(ticket => {
            const serviceDisplay = (ticket.customService && ticket.customService !== ticket.service) ? 
                ticket.customService : ticket.service;
            return serviceDisplay.toLowerCase().includes(serviceFilter);
        });
    }
    
    // Filter by counter
    if (counterFilter) {
        filteredTickets = filteredTickets.filter(ticket => 
            String(ticket.counterId).includes(counterFilter));
    }
    
    // Filter by teller
    if (tellerFilter) {
        filteredTickets = filteredTickets.filter(ticket => {
            const tellerName = ticket.tellerName ? ticket.tellerName.toLowerCase() : 
                (window.counterStaff && window.counterStaff[ticket.counterId] ? 
                window.counterStaff[ticket.counterId].toLowerCase() : '-');
            return tellerName.includes(tellerFilter);
        });
    }
    
    // Filter by status
    if (statusFilter) {
        filteredTickets = filteredTickets.filter(ticket => 
            ticket.status.toLowerCase().includes(statusFilter));
    }
    
    // Filter by created date
    if (createdFilter) {
        filteredTickets = filteredTickets.filter(ticket => 
            new Date(ticket.createdAt).toLocaleString().toLowerCase().includes(createdFilter));
    }
    
    // Display the filtered tickets
    displayTickets(filteredTickets);
}

async function fetchTicketHistory() {
    try {
        // Ensure counter staff data is loaded first
        await fetchCounterStaff();
        
        const status = document.getElementById('statusFilter').value;
        const service = document.getElementById('serviceFilter').value;
        const date = document.getElementById('dateFilter').value;
        
        let url = '/api/tickets/history?';
        if (status) url += `status=${status}&`;
        if (service) url += `service=${service}&`;
        if (date) url += `date=${date}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.tickets) {
            // Store all tickets for client-side filtering
            allTickets = data.tickets;
            displayTickets(data.tickets);
        }
    } catch (error) {
        document.getElementById('ticketTable').innerHTML = '<tr><td colspan="9">Error loading ticket data</td></tr>';
    }
}

function displayTickets(tickets) {
    const tableBody = document.getElementById('ticketTable');
    const tableContainer = document.querySelector('.table-container');
    const filterSection = document.querySelector('.filter-section');
    const deleteActions = document.getElementById('deleteActions');
    
    // Always show table and filters
    if (tableContainer) tableContainer.style.display = 'block';
    if (filterSection) filterSection.style.display = 'block';
    const isAdmin = document.getElementById('admin-controls').style.display !== 'none';
    if (deleteActions && isAdmin) deleteActions.style.display = 'block';
    
    tableBody.innerHTML = '';
    
    if (tickets.length === 0) {
        // Show "No tickets found" message in table body
        const colSpan = isAdmin ? 11 : 9;
        tableBody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align: center; padding: 20px;">No tickets found</td></tr>`;
        return;
    }
    
    tickets.forEach(ticket => {
        const row = document.createElement('tr');
        
        // Format dates
        const createdDate = new Date(ticket.createdAt).toLocaleString();
        const calledDate = ticket.calledAt ? new Date(ticket.calledAt).toLocaleString() : '-';
        const completedDate = ticket.completedAt ? new Date(ticket.completedAt).toLocaleString() : '-';
        
        // Calculate wait time
        let waitTime = '-';
        if (ticket.calledAt && ticket.createdAt) {
            const waitTimeMs = new Date(ticket.calledAt) - new Date(ticket.createdAt);
            const waitTimeMin = Math.round(waitTimeMs / 60000);
            
            // Format wait time more nicely
            if (waitTimeMin < 60) {
                waitTime = `${waitTimeMin} min`;
            } else {
                const hours = Math.floor(waitTimeMin / 60);
                const mins = waitTimeMin % 60;
                waitTime = `${hours}h ${mins}m`;
            }
        } else if (ticket.status === 'waiting') {
            // For waiting tickets, calculate time since creation
            const waitTimeMs = new Date() - new Date(ticket.createdAt);
            const waitTimeMin = Math.round(waitTimeMs / 60000);
            
            if (waitTimeMin < 60) {
                waitTime = `${waitTimeMin} min (waiting)`;
            } else {
                const hours = Math.floor(waitTimeMin / 60);
                const mins = waitTimeMin % 60;
                waitTime = `${hours}h ${mins}m (waiting)`;
            }
        }
        
        // Service time
        let serviceTime = '-';
        if (ticket.serviceTime && ticket.serviceTime > 0) {
            // Format service time more nicely
            if (ticket.serviceTime < 60) {
                serviceTime = `${ticket.serviceTime} min`;
            } else {
                const hours = Math.floor(ticket.serviceTime / 60);
                const mins = ticket.serviceTime % 60;
                serviceTime = `${hours}h ${mins}m`;
            }
        } else if (ticket.status === 'serving' && ticket.calledAt) {
            // For tickets being served, calculate time since called
            const serviceTimeMs = new Date() - new Date(ticket.calledAt);
            const serviceTimeMin = Math.round(serviceTimeMs / 60000);
            
            if (serviceTimeMin < 60) {
                serviceTime = `${serviceTimeMin} min (ongoing)`;
            } else {
                const hours = Math.floor(serviceTimeMin / 60);
                const mins = serviceTimeMin % 60;
                serviceTime = `${hours}h ${mins}m (ongoing)`;
            }
        } else if (ticket.status === 'completed' && ticket.calledAt && ticket.completedAt) {
            // Calculate service time for completed tickets that don't have serviceTime set
            const serviceTimeMs = new Date(ticket.completedAt) - new Date(ticket.calledAt);
            const serviceTimeMin = Math.round(serviceTimeMs / 60000);
            
            if (serviceTimeMin < 60) {
                serviceTime = `${serviceTimeMin} min`;
            } else {
                const hours = Math.floor(serviceTimeMin / 60);
                const mins = serviceTimeMin % 60;
                serviceTime = `${hours}h ${mins}m`;
            }
        }
        
        // Status with color
        let statusHtml = '';
        switch(ticket.status) {
            case 'waiting':
                statusHtml = '<span class="status-waiting">Waiting</span>';
                break;
            case 'serving':
                statusHtml = '<span class="status-serving">Serving</span>';
                break;
            case 'completed':
                statusHtml = '<span class="status-completed">Completed</span>';
                break;
            case 'no-show':
                statusHtml = '<span class="status-no-show">No Show</span>';
                break;
            default:
                statusHtml = ticket.status;
        }
        
        // Display service name without duplication
        let serviceDisplay = ticket.service;
        if (ticket.customService && ticket.customService !== ticket.service) {
            serviceDisplay = ticket.customService;
        }
        
        // Get teller name - use stored teller name first, then current counter staff
        let tellerName = '-';
        if (ticket.tellerName) {
            tellerName = ticket.tellerName;
        } else if (window.counterStaff && window.counterStaff[ticket.counterId]) {
            tellerName = window.counterStaff[ticket.counterId];
        }
        
        // Check if admin controls are visible
        const isAdmin = document.getElementById('admin-controls').style.display !== 'none';
        
        row.innerHTML = `
            ${isAdmin ? `<td><input type="checkbox" class="ticket-checkbox" data-ticket-id="${ticket._id}" onchange="updateDeleteButton()"></td>` : ''}
            <td>${ticket.ticketNumber}</td>
            <td>${ticket.customerName}</td>
            <td>${serviceDisplay}</td>
            <td>${ticket.counterId || '-'}</td>
            <td>${tellerName}</td>
            <td>${statusHtml}</td>
            <td>${createdDate}</td>
            <td>${waitTime}</td>
            <td>${serviceTime}</td>
            ${isAdmin ? `<td><button class="delete-single-btn" onclick="deleteSingleTicket('${ticket._id}')"><i class="fas fa-trash-alt"></i></button></td>` : ''}
        `;
        
        tableBody.appendChild(row);
    });
}