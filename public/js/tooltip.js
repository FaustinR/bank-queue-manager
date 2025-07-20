// Simple tooltip implementation
document.addEventListener('DOMContentLoaded', function() {
    // Create a tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'sidebar-tooltip';
    tooltip.style.cssText = `
        position: fixed;
        background: #1e3d6f;
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        z-index: 9999;
        display: none;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        pointer-events: none;
    `;
    document.body.appendChild(tooltip);
    
    // Add event listeners to sidebar links
    const sidebarLinks = document.querySelectorAll('.sidebar-nav li a');
    const sidebar = document.querySelector('.sidebar');
    
    sidebarLinks.forEach(link => {
        link.addEventListener('mouseenter', function(e) {
            if (sidebar.classList.contains('folded')) {
                // Get the current text from the span (in case it was changed dynamically)
                const text = link.querySelector('span').textContent.trim();
                tooltip.textContent = text;
                tooltip.style.display = 'block';
                
                // Position the tooltip next to the link
                const rect = link.getBoundingClientRect();
                tooltip.style.top = (rect.top + rect.height/2 - tooltip.offsetHeight/2) + 'px';
                tooltip.style.left = (rect.right + 10) + 'px';
            }
        });
        
        link.addEventListener('mouseleave', function() {
            tooltip.style.display = 'none';
        });
    });
});