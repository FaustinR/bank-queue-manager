const socket = io();

// Handle "Other" service selection
document.getElementById('service').addEventListener('change', function() {
    const otherServiceGroup = document.getElementById('otherServiceGroup');
    const otherServiceInput = document.getElementById('otherService');
    
    if (this.value === 'Other') {
        otherServiceGroup.style.display = 'block';
        otherServiceInput.required = true;
    } else {
        otherServiceGroup.style.display = 'none';
        otherServiceInput.required = false;
        otherServiceInput.value = '';
    }
});

document.getElementById('ticketForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const customerName = document.getElementById('customerName').value;
    let service = document.getElementById('service').value;
    const language = document.getElementById('language').value;
    
    // Handle "Other" service
    if (service === 'Other') {
        const otherService = document.getElementById('otherService').value.trim();
        if (!otherService) {
            alert('Please specify your inquiry when selecting "Other"');
            return;
        }
        service = otherService;
    }
    
    console.log('Form data being sent:', { customerName, service, language });
    
    try {
        const response = await fetch('/api/ticket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerName, service, language })
        });
        
        const ticket = await response.json();
        
        // Show receipt with animation
        document.getElementById('receiptName').textContent = ticket.customerName;
        document.getElementById('receiptService').textContent = ticket.service;
        document.getElementById('receiptLanguage').textContent = ticket.language || 'Not specified';
        document.getElementById('receiptNumber').textContent = ticket.number;
        document.getElementById('receiptTime').textContent = new Date(ticket.timestamp).toLocaleTimeString();
        
        console.log('Ticket data:', ticket);
        
        // Generate QR code
        const ticketUrl = `${window.location.origin}/ticket?name=${encodeURIComponent(ticket.customerName)}&service=${encodeURIComponent(ticket.service)}&language=${encodeURIComponent(ticket.language)}&number=${ticket.number}&time=${encodeURIComponent(new Date(ticket.timestamp).toLocaleTimeString())}&counter=${ticket.counterId}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(ticketUrl)}`;
        
        const qrImg = document.createElement('img');
        qrImg.src = qrUrl;
        qrImg.alt = 'QR Code';
        qrImg.style.width = '120px';
        qrImg.style.height = '120px';
        
        qrImg.onerror = function() {
            document.getElementById('qrcode').innerHTML = '<div style="width: 120px; height: 120px; border: 1px solid #ddd; display: flex; align-items: center; justify-content: center; font-size: 10px;">QR Code<br>Unavailable</div>';
        };
        
        document.getElementById('qrcode').innerHTML = '';
        document.getElementById('qrcode').appendChild(qrImg);
        
        // Trigger animations
        const mainContainer = document.querySelector('.main-container');
        const ticketSection = document.querySelector('.ticket-section');
        
        // Add classes for animation
        mainContainer.classList.add('ticket-generated');
        
        // Delay to allow form section to resize first
        setTimeout(() => {
            ticketSection.classList.add('show');
        }, 300);
        
        // Hide "Other" service field after ticket generation
        document.getElementById('otherServiceGroup').style.display = 'none';
        document.getElementById('otherService').required = false;
        
        // Reset form
        document.getElementById('ticketForm').reset();
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error getting ticket. Please try again.');
    }
});

socket.on('queueUpdate', (data) => {
    const totalWaiting = Object.values(data.queues).reduce((sum, queue) => sum + queue.length, 0);
    document.getElementById('queueCount').textContent = totalWaiting;
    if (document.getElementById('queueCountMobile')) {
        document.getElementById('queueCountMobile').textContent = totalWaiting;
    }
});