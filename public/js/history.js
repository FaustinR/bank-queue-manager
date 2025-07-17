document.addEventListener('DOMContentLoaded', function() {
    fetchTicketHistory();
    
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
});

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
            waitTime = `${waitTimeMin} min`;
        }
        
        // Service time
        const serviceTime = ticket.serviceTime ? `${ticket.serviceTime} min` : '-';
        
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
        
        row.innerHTML = `
            <td>${ticket.ticketNumber}</td>
            <td>${ticket.customerName}</td>
            <td>${ticket.service}${ticket.customService ? ` (${ticket.customService})` : ''}</td>
            <td>${ticket.counterId || '-'}</td>
            <td>${statusHtml}</td>
            <td>${createdDate}</td>
            <td>${waitTime}</td>
            <td>${serviceTime}</td>
        `;
        
        tableBody.appendChild(row);
    });
}