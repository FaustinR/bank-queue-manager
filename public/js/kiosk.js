// Connect to Socket.IO with error handling
let socket;
try {
    socket = io({
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000
    });
    
    socket.on('connect_error', (err) => {
        console.error('Socket.IO connection error:', err);
    });
    
    socket.on('connect', () => {
        console.log('Socket.IO connected successfully');
    });
} catch (error) {
    console.error('Socket.IO initialization error:', error);
}

// Show/hide other service field based on selection
document.getElementById('service').addEventListener('change', function() {
    const otherServiceGroup = document.getElementById('otherServiceGroup');
    otherServiceGroup.style.display = this.value === 'Other' ? 'block' : 'none';
    
    // Make the other service field required only when 'Other' is selected
    const otherServiceField = document.getElementById('otherService');
    otherServiceField.required = this.value === 'Other';
});

document.getElementById('ticketForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const customerName = document.getElementById('customerName').value;
    let service = document.getElementById('service').value;
    const language = document.getElementById('language').value;
    
    // Validate that otherService is filled when 'Other' is selected
    if (service === 'Other') {
        const otherService = document.getElementById('otherService').value.trim();
        if (!otherService) {
            alert('Please specify your inquiry when selecting "Other"');
            document.getElementById('otherService').focus();
            return;
        }
    }
    
    // If 'Other' is selected, use the custom text instead
    if (service === 'Other') {
        const otherService = document.getElementById('otherService').value;
        if (otherService.trim()) {
            service = 'Other: ' + otherService.trim();
            console.log('Using custom service:', service);
        } else {
            service = 'General Inquiry'; // Fallback if no custom text is provided
            console.log('No custom text provided, using General Inquiry');
        }
    }
    
    console.log('Form data being sent:', { customerName, service, language }); // Debug log
    
    try {
        const requestBody = { customerName, service, language };
        console.log('Sending request to:', window.location.origin + '/api/ticket');
        console.log('Request body:', JSON.stringify(requestBody));
        
        const response = await fetch('/api/ticket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API error:', response.status, errorText);
            throw new Error(`API error: ${response.status} - ${errorText}`);
        }
        
        const ticket = await response.json();
        
        // Show receipt
        document.getElementById('receiptName').textContent = ticket.customerName;
        document.getElementById('receiptService').textContent = ticket.service;
        document.getElementById('receiptLanguage').textContent = ticket.language || 'Not specified';
        document.getElementById('receiptNumber').textContent = ticket.number;
        document.getElementById('receiptTime').textContent = new Date(ticket.timestamp).toLocaleTimeString();
        
        console.log('Ticket data:', ticket); // Debug log
        
        // Generate QR code that redirects to ticket page
        const ticketUrl = `${window.location.origin}/ticket?name=${encodeURIComponent(ticket.customerName)}&service=${encodeURIComponent(ticket.service)}&language=${encodeURIComponent(ticket.language)}&number=${ticket.number}&time=${encodeURIComponent(new Date(ticket.timestamp).toLocaleTimeString())}&counter=${ticket.counterId}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(ticketUrl)}`;
        
        const qrImg = document.createElement('img');
        qrImg.src = qrUrl;
        qrImg.alt = 'QR Code';
        qrImg.style.width = '120px';
        qrImg.style.height = '120px';
        qrImg.style.border = '1px solid #ddd';
        
        qrImg.onerror = function() {
            document.getElementById('qrcode').innerHTML = '<div style="width: 120px; height: 120px; border: 1px solid #ddd; display: flex; align-items: center; justify-content: center; font-size: 10px;">QR Code<br>Unavailable</div>';
        };
        
        document.getElementById('qrcode').innerHTML = '';
        document.getElementById('qrcode').appendChild(qrImg);
        
        document.getElementById('receipt').style.display = 'block';
        
        // Reset form
        document.getElementById('ticketForm').reset();
        
        // Ensure the otherServiceGroup is hidden after form reset
        document.getElementById('otherServiceGroup').style.display = 'none';
        
    } catch (error) {
        console.error('Error getting ticket:', error);
        alert('Error getting ticket: ' + error.message);
    }
});

socket.on('queueUpdate', (data) => {
    const totalWaiting = Object.values(data.queues).reduce((sum, queue) => sum + queue.length, 0);
    document.getElementById('queueCount').textContent = totalWaiting;
    
    // Update mobile queue count as well
    const mobileQueueCount = document.getElementById('queueCountMobile');
    if (mobileQueueCount) {
        mobileQueueCount.textContent = totalWaiting;
    }
});