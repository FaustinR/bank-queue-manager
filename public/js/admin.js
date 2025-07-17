document.addEventListener('DOMContentLoaded', function() {
    // Fetch user info
    fetchUserInfo();
    
    // Fetch statistics
    fetchStats();
    
    // Refresh stats every 30 seconds
    setInterval(fetchStats, 30000);
});

async function fetchUserInfo() {
    try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        
        if (response.ok && data.user) {
            document.getElementById('userName').textContent = `${data.user.firstName} ${data.user.lastName}`;
            document.getElementById('userRole').textContent = data.user.role;
        } else {
            // If not authenticated, redirect to login
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Error fetching user info:', error);
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
        console.error('Error fetching statistics:', error);
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