// Audio context for notification sound
function playNotificationSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create oscillator for a bell-like sound
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 1000; // Hz
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 1);
        
        // Play a second tone after a short delay
        setTimeout(() => {
            const oscillator2 = audioContext.createOscillator();
            oscillator2.connect(gainNode);
            oscillator2.type = 'sine';
            oscillator2.frequency.value = 1200; // Hz
            
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
            
            oscillator2.start(audioContext.currentTime);
            oscillator2.stop(audioContext.currentTime + 1);
        }, 500);
    } catch (error) {
        console.error('Error playing notification sound:', error);
    }
}