// Get ticket data from URL parameters
const urlParams = new URLSearchParams(window.location.search);

document.getElementById('customerName').textContent = urlParams.get('name') || '-';
document.getElementById('service').textContent = urlParams.get('service') || '-';
document.getElementById('language').textContent = urlParams.get('language') || '-';
document.getElementById('queueNumber').textContent = urlParams.get('number') || '-';
document.getElementById('time').textContent = urlParams.get('time') || '-';
document.getElementById('counter').textContent = urlParams.get('counter') || '-';

// Update page title
document.title = `Queue Ticket #${urlParams.get('number') || ''}`;