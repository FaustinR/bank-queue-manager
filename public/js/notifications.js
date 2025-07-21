// Notification system
class NotificationSystem {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    // Create container if it doesn't exist
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'notification-container';
      document.body.appendChild(this.container);
    }
  }

  show(options) {
    const { type = 'info', title, message, duration = 5000, icon } = options;
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // Determine icon based on type
    let iconClass;
    switch (type) {
      case 'success':
        iconClass = 'fas fa-check-circle';
        break;
      case 'error':
        iconClass = 'fas fa-exclamation-circle';
        break;
      case 'warning':
        iconClass = 'fas fa-exclamation-triangle';
        break;
      case 'info':
      default:
        iconClass = 'fas fa-info-circle';
    }
    
    // Build notification HTML
    notification.innerHTML = `
      <div class="notification-icon">
        <i class="${icon || iconClass}"></i>
      </div>
      <div class="notification-content">
        <div class="notification-title">${title}</div>
        <div class="notification-message">${message}</div>
      </div>
      <button class="notification-close">&times;</button>
      <div class="notification-progress">
        <div class="notification-progress-bar"></div>
      </div>
    `;
    
    // Add to container
    this.container.appendChild(notification);
    
    // Add close button event
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => this.close(notification));
    
    // Auto close after duration
    setTimeout(() => {
      this.close(notification);
    }, duration);
    
    return notification;
  }
  
  close(notification) {
    if (!notification.classList.contains('hide')) {
      notification.classList.add('hide');
      notification.addEventListener('animationend', () => {
        notification.remove();
      });
    }
  }
  
  // Convenience methods
  success(title, message, duration) {
    return this.show({ type: 'success', title, message, duration });
  }
  
  error(title, message, duration) {
    return this.show({ type: 'error', title, message, duration });
  }
  
  info(title, message, duration) {
    return this.show({ type: 'info', title, message, duration });
  }
  
  warning(title, message, duration) {
    return this.show({ type: 'warning', title, message, duration });
  }
}

// Create global notification instance
window.notifications = new NotificationSystem();