// Store all tickets for client-side filtering
let allTickets = [];

// Initialize socket connection if available
let socket;
if (typeof io !== 'undefined') {
    socket = io();
    
    // Listen for queue updates to refresh ticket history
    socket.on('queueUpdate', function() {
        fetchTicketHistory();
    });
    
    // Listen for specific ticket updates
    socket.on('ticketUpdated', function() {
        fetchTicketHistory();
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Check if page is in an iframe
    if (window.self !== window.top) {
        // We're in an iframe
        document.body.classList.add('embedded-history');
    }
    
    fetchTicketHistory();
    
    // Set up auto-refresh every 30 seconds
    const refreshInterval = setInterval(fetchTicketHistory, 30000);
    
    // Clean up interval when page is unloaded
    window.addEventListener('beforeunload', function() {
        clearInterval(refreshInterval);
    });
    
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.addEventListener('click', function() {
        // Add active class to show button is clicked
        refreshBtn.classList.add('active');
        
        // Fetch data
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
});

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
            case 4: // Status
                valueA = a.status.toLowerCase();
                valueB = b.status.toLowerCase();
                break;
            case 5: // Created
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

function filterTickets() {
    // Get filter values
    const ticketNumberFilter = document.getElementById('ticketNumberFilter').value.toLowerCase();
    const customerFilter = document.getElementById('customerFilter').value.toLowerCase();
    const serviceFilter = document.getElementById('serviceColumnFilter').value.toLowerCase();
    const counterFilter = document.getElementById('counterFilter').value.toLowerCase();
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
        console.error('Error fetching ticket history:', error);
        document.getElementById('ticketTable').innerHTML = '<tr><td colspan="8">Error loading ticket data</td></tr>';
    }
}

function displayTickets(tickets) {
    const tableBody = document.getElementById('ticketTable');
    tableBody.innerHTML = '';
    
    if (tickets.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8">No tickets found</td></tr>';
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
        
        row.innerHTML = `
            <td>${ticket.ticketNumber}</td>
            <td>${ticket.customerName}</td>
            <td>${serviceDisplay}</td>
            <td>${ticket.counterId || '-'}</td>
            <td>${statusHtml}</td>
            <td>${createdDate}</td>
            <td>${waitTime}</td>
            <td>${serviceTime}</td>
        `;
        
        tableBody.appendChild(row);
    });
}