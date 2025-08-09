const socket = io();

// Adjust form height when the page loads
document.addEventListener('DOMContentLoaded', function() {
    adjustFormHeight();
});

// Function to adjust form height based on screen size
function adjustFormHeight() {
    const formSection = document.querySelector('.form-section');
    if (formSection) {
        const viewportHeight = window.innerHeight;
        const isTicketGenerated = document.body.classList.contains('ticket-generated');
        
        // Set height based on viewport
        let minHeight = '650px';
        if (viewportHeight < 700) {
            minHeight = '600px';
        } else if (viewportHeight > 900) {
            minHeight = '700px';
        }
        
        if (isTicketGenerated) {
            // Ensure ticket section has same height
            const ticketSection = document.querySelector('.ticket-section');
            if (ticketSection) {
                ticketSection.style.height = minHeight;
                ticketSection.style.minHeight = minHeight;
            }
        }
    }
}

// Adjust form height on page load
window.addEventListener('load', adjustFormHeight);

// Adjust form height on window resize
window.addEventListener('resize', adjustFormHeight);

// Handle "Other" service selection
document.getElementById('service').addEventListener('change', function() {
    const otherServiceGroup = document.getElementById('otherServiceGroup');
    const otherServiceInput = document.getElementById('otherService');
    const formSection = document.querySelector('.form-section');
    
    if (this.value === 'Other') {
        otherServiceGroup.style.display = 'block';
        otherServiceInput.required = true;
        
        // Adjust form height when Other is selected
        setTimeout(adjustFormHeight, 10);
    } else {
        otherServiceGroup.style.display = 'none';
        otherServiceInput.required = false;
        otherServiceInput.value = '';
        
        // Reset form height when Other is deselected
        if (window.innerWidth >= 768) {
            formSection.style.minHeight = '';
        }
        
        // Adjust form height when Other is deselected
        setTimeout(adjustFormHeight, 10);
    }
    
    // Clear error when service is selected
    if (this.value) {
        clearFieldError('service');
    }
    checkFormCompletion();
});

// Check if form is complete and show/hide button
function checkFormCompletion() {
    const customerName = document.getElementById('customerName').value.trim();
    const service = document.getElementById('service').value;
    const language = document.getElementById('language').value;
    const otherService = document.getElementById('otherService').value.trim();
    const button = document.querySelector('button[type="submit"]');
    
    let isComplete = customerName && service && language;
    
    // If "Other" is selected, check if otherService is filled
    if (service === 'Other') {
        isComplete = isComplete && otherService;
    }
    
    if (isComplete) {
        button.classList.add('show');
    } else {
        button.classList.remove('show');
    }
}

// Add event listeners to clear errors on input
document.getElementById('customerName').addEventListener('input', function() {
    if (this.value.trim()) {
        clearFieldError('customerName');
    }
    checkFormCompletion();
});

document.getElementById('language').addEventListener('change', function() {
    if (this.value) {
        clearFieldError('language');
    }
    checkFormCompletion();
});

document.getElementById('otherService').addEventListener('input', function() {
    if (this.value.trim()) {
        clearFieldError('otherService');
    }
    checkFormCompletion();
});

// Clear field errors
function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    const errorMsg = field.parentNode.querySelector('.error-message');
    field.classList.remove('field-error');
    if (errorMsg) {
        errorMsg.style.display = 'none';
    }
}

// Show field error
function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    field.classList.add('field-error');
    
    let errorMsg = field.parentNode.querySelector('.error-message');
    if (!errorMsg) {
        errorMsg = document.createElement('div');
        errorMsg.className = 'error-message';
        field.parentNode.appendChild(errorMsg);
    }
    
    errorMsg.textContent = message;
    errorMsg.style.display = 'block';
}

document.getElementById('ticketForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Clear all previous errors
    clearFieldError('customerName');
    clearFieldError('service');
    clearFieldError('language');
    clearFieldError('otherService');
    
    const customerName = document.getElementById('customerName').value.trim();
    let service = document.getElementById('service').value;
    const language = document.getElementById('language').value;
    
    let hasErrors = false;
    
    // Validate required fields
    if (!customerName) {
        showFieldError('customerName', 'Your name is required');
        hasErrors = true;
    }
    
    if (!service) {
        showFieldError('service', 'Please select a service');
        hasErrors = true;
    }
    
    if (!language) {
        showFieldError('language', 'Please select your preferred language');
        hasErrors = true;
    }
    
    // Handle "Other" service
    if (service === 'Other') {
        const otherService = document.getElementById('otherService').value.trim();
        if (!otherService) {
            showFieldError('otherService', 'Please specify your inquiry');
            hasErrors = true;
        } else {
            service = otherService;
        }
    }
    
    if (hasErrors) {
        return;
    }
    

    
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
        document.body.classList.add('ticket-generated');
        
        // Delay to allow form section to resize first
        setTimeout(() => {
            ticketSection.classList.add('show');
            adjustFormHeight();
        }, 300);
        
        // Hide "Other" service field after ticket generation
        document.getElementById('otherServiceGroup').style.display = 'none';
        document.getElementById('otherService').required = false;
        
        // Reset form and dropdowns
        document.getElementById('ticketForm').reset();
        
        // Reset original select elements
        document.getElementById('service').selectedIndex = 0;
        document.getElementById('language').selectedIndex = 0;
        
        // Reset custom select elements
        const customSelects = document.querySelectorAll('.selected-option');
        customSelects.forEach(select => {
            // Find which select this is based on its position
            const isServiceSelect = select.closest('.form-group').querySelector('label').textContent.includes('Service');
            if (isServiceSelect) {
                select.textContent = 'Select a service';
            } else {
                select.textContent = 'Select language';
            }
        });
        
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