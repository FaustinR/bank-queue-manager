// Persistent call notification system with WebRTC audio
(function() {
    let currentNotification = null;
    let activeCall = null;
    let peerConnection = null;
    let localStream = null;
    let remoteStream = null;
    let remoteAudio = null;
    let localAudio = null;
    let isMuted = false;

    const CALL_STORAGE_KEY = 'activeCall';
    
    // Create audio elements for call audio with mobile compatibility
    function createAudioElements() {
        if (!remoteAudio) {
            remoteAudio = document.createElement('audio');
            remoteAudio.autoplay = true;
            remoteAudio.controls = false;
            remoteAudio.playsInline = true; // Critical for iOS
            remoteAudio.style.display = 'none';
            document.body.appendChild(remoteAudio);
        }
        
        if (!localAudio) {
            localAudio = document.createElement('audio');
            localAudio.autoplay = true;
            localAudio.controls = false;
            localAudio.muted = true; // Prevent echo
            localAudio.playsInline = true; // Critical for iOS
            localAudio.style.display = 'none';
            document.body.appendChild(localAudio);
        }
    }

    // Load active call state from localStorage
    function loadCallState() {
        try {
            const stored = localStorage.getItem(CALL_STORAGE_KEY);
            if (stored) {
                activeCall = JSON.parse(stored);
                if (activeCall && activeCall.timestamp) {
                    const now = Date.now();
                    const callAge = now - activeCall.timestamp;
                    if (callAge > 5 * 60 * 1000) {
                        clearCallState();
                        return null;
                    }
                    return activeCall;
                }
            }
        } catch (e) {
            clearCallState();
        }
        return null;
    }
    
    // Save call state to localStorage
    function saveCallState(callData) {
        try {
            activeCall = { ...callData, timestamp: Date.now() };
            localStorage.setItem(CALL_STORAGE_KEY, JSON.stringify(activeCall));
        } catch (e) {
            console.error('Failed to save call state:', e);
        }
    }
    
    // Clear call state
    function clearCallState() {
        activeCall = null;
        try {
            localStorage.removeItem(CALL_STORAGE_KEY);
        } catch (e) {}
    }

    // WebRTC initialization with audio support
    async function initializeWebRTC() {
        try {
            createAudioElements();
            
            // Simple audio constraints for reliability
            const audioConstraints = {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            };
            
            // iOS Safari compatible audio capture
            try {
                // Request microphone permission explicitly
                const constraints = {
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                        sampleRate: 44100
                    },
                    video: false
                };
                
                localStream = await navigator.mediaDevices.getUserMedia(constraints);
                console.log('Audio stream obtained:', localStream.getAudioTracks().length, 'tracks');
                
                // Verify audio tracks are active
                const audioTracks = localStream.getAudioTracks();
                if (audioTracks.length === 0) {
                    throw new Error('No audio tracks in stream');
                }
                
                audioTracks.forEach(track => {
                    console.log('Audio track:', track.label, 'enabled:', track.enabled, 'ready:', track.readyState);
                });
                
            } catch (error) {
                console.error('Failed to get audio stream:', error);
                alert('Microphone access denied. Please allow microphone access and refresh the page.');
                throw error;
            }
            
            // Set local audio stream (muted to prevent echo)
            if (localAudio) {
                localAudio.srcObject = localStream;
            }
            
            // Create peer connection with comprehensive STUN/TURN servers
            peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' }
                ],
                iceCandidatePoolSize: 10,
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require'
            });
            
            // Add local stream to peer connection
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
            
            // Handle remote stream with enhanced mobile compatibility
            peerConnection.ontrack = (event) => {
                console.log('Received remote stream with tracks:', event.streams[0].getTracks().length);
                remoteStream = event.streams[0];
                
                // Verify we have audio tracks
                const audioTracks = remoteStream.getAudioTracks();
                console.log('Remote audio tracks:', audioTracks.length);
                
                if (audioTracks.length === 0) {
                    console.error('No remote audio tracks received');
                    return;
                }
                
                // Connect remote stream to audio element for playback
                if (remoteAudio && remoteStream) {
                    console.log('Setting up remote audio stream for iPhone');
                    
                    // Clear any existing source first
                    remoteAudio.srcObject = null;
                    remoteAudio.src = '';
                    
                    // Set up audio element for iPhone compatibility
                    remoteAudio.srcObject = remoteStream;
                    remoteAudio.volume = 1.0;
                    remoteAudio.muted = false;
                    remoteAudio.autoplay = true;
                    remoteAudio.controls = false;
                    
                    // Critical iOS Safari attributes
                    remoteAudio.setAttribute('playsinline', 'true');
                    remoteAudio.setAttribute('webkit-playsinline', 'true');
                    remoteAudio.setAttribute('preload', 'auto');
                    
                    // Force audio to use device speakers on iPhone
                    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                        remoteAudio.setAttribute('x-webkit-airplay', 'allow');
                        remoteAudio.style.webkitPlaysinline = 'true';
                        
                        // Try to set audio output to speakers if supported
                        if (remoteAudio.setSinkId) {
                            remoteAudio.setSinkId('default').catch(e => console.log('setSinkId not supported:', e));
                        }
                    }
                    
                    // Enhanced audio play with multiple fallbacks
                    const playAudio = async () => {
                        try {
                            console.log('Attempting to play remote audio...');
                            
                            // Load the audio first
                            remoteAudio.load();
                            
                            // Wait for loadeddata event
                            await new Promise((resolve, reject) => {
                                const timeout = setTimeout(() => reject(new Error('Audio load timeout')), 3000);
                                
                                remoteAudio.addEventListener('loadeddata', () => {
                                    clearTimeout(timeout);
                                    resolve();
                                }, { once: true });
                                
                                remoteAudio.addEventListener('error', (e) => {
                                    clearTimeout(timeout);
                                    reject(e);
                                }, { once: true });
                            });
                            
                            // Now try to play
                            const playPromise = remoteAudio.play();
                            await playPromise;
                            
                            console.log('Remote audio playing successfully on iPhone');
                            
                            // Verify audio is actually playing
                            setTimeout(() => {
                                if (remoteAudio.paused) {
                                    console.log('Audio paused unexpectedly, retrying...');
                                    remoteAudio.play().catch(console.error);
                                }
                            }, 500);
                            
                        } catch (e) {
                            console.log('iPhone audio play failed, enabling on interaction:', e);
                            
                            // Show audio enable button
                            showAudioEnableButton();
                            
                            // Enable on any user interaction with enhanced iPhone support
                            const enableAudio = async () => {
                                try {
                                    console.log('User interaction detected, enabling iPhone audio...');
                                    
                                    // Force reload and play
                                    remoteAudio.load();
                                    await remoteAudio.play();
                                    
                                    console.log('iPhone audio enabled successfully');
                                    
                                    const btn = document.querySelector('.enable-audio-btn');
                                    if (btn) btn.remove();
                                    
                                    // Remove listeners
                                    document.removeEventListener('click', enableAudio);
                                    document.removeEventListener('touchstart', enableAudio);
                                    document.removeEventListener('touchend', enableAudio);
                                    
                                } catch (err) {
                                    console.error('Failed to enable iPhone audio:', err);
                                    alert('Please tap the screen to enable audio reception');
                                }
                            };
                            
                            // Add multiple event listeners for iPhone
                            document.addEventListener('click', enableAudio, { once: true });
                            document.addEventListener('touchstart', enableAudio, { once: true });
                            document.addEventListener('touchend', enableAudio, { once: true });
                        }
                    };
                    
                    // Delay to ensure stream is ready, longer for iPhone
                    setTimeout(playAudio, /iPad|iPhone|iPod/.test(navigator.userAgent) ? 300 : 100);
                }
            };
            
            // Handle ICE candidates
            peerConnection.onicecandidate = (event) => {
                if (event.candidate && activeCall) {
                    const socket = getSocket();
                    socket.emit('ice-candidate', {
                        targetId: activeCall.type === 'incoming' ? activeCall.callerId : activeCall.recipientId,
                        candidate: event.candidate
                    });
                }
            };
            
            return true;
        } catch (error) {
            console.error('Failed to initialize WebRTC:', error);
            alert('Microphone access denied. Please allow microphone access for voice calls.');
            return false;
        }
    }
    
    // Show button to enable audio if auto-play is blocked
    function showAudioEnableButton() {
        if (currentNotification && !currentNotification.querySelector('.enable-audio-btn')) {
            const enableBtn = document.createElement('button');
            enableBtn.className = 'enable-audio-btn';
            enableBtn.textContent = 'Enable Audio';
            enableBtn.style.cssText = 'background: #ffc107; color: black; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; margin-top: 10px;';
            enableBtn.onclick = () => {
                if (remoteAudio) {
                    remoteAudio.play();
                    enableBtn.remove();
                }
            };
            currentNotification.appendChild(enableBtn);
        }
    }

    // Show call notification with persistent state
    function showCallNotification(callData) {
        saveCallState(callData);
        
        if (currentNotification) {
            currentNotification.remove();
        }

        const notification = document.createElement('div');
        notification.id = 'callNotification';
        notification.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: ${callData.type === 'incoming' ? '#28a745' : '#007bff'};
            color: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 99999;
            font-family: Arial, sans-serif;
            min-width: 350px;
            max-width: 450px;
            cursor: move;
            user-select: none;
            touch-action: none;
            -webkit-user-select: none;
            -webkit-touch-callout: none;
        `;
        
        // Mobile responsive adjustments
        if (window.innerWidth <= 480) {
            notification.style.minWidth = '280px';
            notification.style.maxWidth = '95vw';
            notification.style.padding = '15px';
            notification.style.fontSize = '14px';
        }

        // Create notification content with action buttons
        let actionButtons = '';
        if (callData.status === 'active') {
            actionButtons = `
                <div style="margin-top: 15px; display: flex; gap: 8px; justify-content: center; align-items: center; flex-wrap: wrap;">
                    <button onclick="toggleMute()" id="muteBtn" style="background: #6c757d; color: white; border: none; padding: 12px 16px; border-radius: 5px; cursor: pointer; min-width: 44px; min-height: 44px; font-size: 14px; touch-action: manipulation;">🎤 Mute</button>
                    <button onclick="toggleSpeaker()" id="speakerBtn" style="background: #17a2b8; color: white; border: none; padding: 12px 16px; border-radius: 5px; cursor: pointer; min-width: 44px; min-height: 44px; font-size: 14px; touch-action: manipulation;">🔊 Speaker</button>
                    <button onclick="endCall()" style="background: #dc3545; color: white; border: none; padding: 12px 16px; border-radius: 5px; cursor: pointer; min-width: 44px; min-height: 44px; font-size: 14px; touch-action: manipulation;">End Call</button>
                </div>
            `;
        } else if (callData.type === 'incoming') {
            actionButtons = `
                <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <button onclick="acceptCall()" style="background: #28a745; color: white; border: none; padding: 12px 20px; border-radius: 5px; cursor: pointer; min-width: 44px; min-height: 44px; font-size: 16px; touch-action: manipulation;">Accept</button>
                    <button onclick="declineCall()" style="background: #dc3545; color: white; border: none; padding: 12px 20px; border-radius: 5px; cursor: pointer; min-width: 44px; min-height: 44px; font-size: 16px; touch-action: manipulation;">Decline</button>
                </div>
            `;
        } else if (callData.type === 'outgoing') {
            actionButtons = `
                <div style="margin-top: 15px; display: flex; gap: 8px; justify-content: center; align-items: center; flex-wrap: wrap;">
                    <button onclick="toggleMute()" id="muteBtn" style="background: #6c757d; color: white; border: none; padding: 12px 16px; border-radius: 5px; cursor: pointer; min-width: 44px; min-height: 44px; font-size: 14px; touch-action: manipulation;">🎤 Mute</button>
                    <button onclick="toggleSpeaker()" id="speakerBtn" style="background: #17a2b8; color: white; border: none; padding: 12px 16px; border-radius: 5px; cursor: pointer; min-width: 44px; min-height: 44px; font-size: 14px; touch-action: manipulation;">🔊 Speaker</button>
                    <button onclick="endCall()" style="background: #dc3545; color: white; border: none; padding: 12px 16px; border-radius: 5px; cursor: pointer; min-width: 44px; min-height: 44px; font-size: 14px; touch-action: manipulation;">End Call</button>
                </div>
            `;
        }
        
        const minimizeIcon = '−';
        
        notification.innerHTML = `
            <div style="position: relative;">
                <button onclick="toggleMinimize('${notification.id}')" style="position: absolute; top: -8px; right: -8px; background: rgba(255,255,255,0.9); border: 2px solid white; color: #333; width: 35px; height: 35px; border-radius: 50%; cursor: pointer; font-size: 16px; font-weight: bold; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.3); transition: all 0.2s ease; z-index: 1000;" id="minimizeBtn" onmouseover="this.style.background='white'; this.style.transform='scale(1.1)'" onmouseout="this.style.background='rgba(255,255,255,0.9)'; this.style.transform='scale(1)'">${minimizeIcon}</button>
                <div class="notification-content">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="background: rgba(255,255,255,0.2); border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-phone${callData.type === 'outgoing' ? '' : '-alt'}" style="font-size: 20px;"></i>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: bold; font-size: 16px; margin-bottom: 8px;" class="caller-name">
                                ${callData.status === 'active' ? 'Active Call' : (callData.type === 'incoming' ? 'Incoming Call' : 'Calling...')}
                            </div>
                            <div style="font-size: 14px; margin-bottom: 4px;" class="call-details">
                                <strong>Name:</strong> ${callData.name}
                            </div>
                            <div style="font-size: 14px; margin-bottom: 4px;" class="call-details">
                                <strong>Counter:</strong> Counter ${callData.counter}
                            </div>
                            <div style="font-size: 14px;" class="call-details">
                                <strong>Service:</strong> ${callData.service}
                            </div>
                        </div>
                    </div>
                    <div class="action-buttons">${actionButtons}</div>
                </div>
                <div class="minimized-content" style="display: none; text-align: center; padding: 10px;">
                    <strong>${callData.name}</strong>
                </div>
            </div>
        `;

        document.body.appendChild(notification);
        currentNotification = notification;
        
        // Make notification draggable
        makeDraggable(notification);

        if (!document.querySelector('link[href*="font-awesome"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
            document.head.appendChild(link);
        }
    }

    // Hide call notification and clear state
    function hideCallNotification() {
        if (currentNotification) {
            currentNotification.remove();
            currentNotification = null;
        }
        clearCallState();
        
        // Clean up WebRTC resources
        if (peerConnection) {
            peerConnection.onconnectionstatechange = null; // Remove event listener
            peerConnection.close();
            peerConnection = null;
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        
        // Clean up audio elements
        if (remoteAudio) {
            remoteAudio.srcObject = null;
        }
        if (localAudio) {
            localAudio.srcObject = null;
        }
    }

    // Make element draggable with enhanced mobile support
    function makeDraggable(element) {
        let isDragging = false;
        let startX, startY, initialX, initialY;
        let dragTimeout;
        
        function handleStart(e) {
            // Don't drag if clicking on buttons or inputs
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
            
            // Clear any existing timeout
            if (dragTimeout) clearTimeout(dragTimeout);
            
            // Handle both mouse and touch events
            const clientX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
            const clientY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
            
            startX = clientX;
            startY = clientY;
            
            const rect = element.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            
            // For touch events, add a small delay to distinguish from tap
            if (e.type === 'touchstart') {
                dragTimeout = setTimeout(() => {
                    isDragging = true;
                    element.style.transform = 'none';
                    element.style.left = initialX + 'px';
                    element.style.top = initialY + 'px';
                    element.style.zIndex = '100000';
                }, 150);
            } else {
                isDragging = true;
                element.style.transform = 'none';
                element.style.left = initialX + 'px';
                element.style.top = initialY + 'px';
                element.style.zIndex = '100000';
            }
            
            e.preventDefault();
        }
        
        function handleMove(e) {
            if (!isDragging) return;
            
            const clientX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
            const clientY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
            
            const deltaX = clientX - startX;
            const deltaY = clientY - startY;
            
            // Add margin for mobile viewport
            const margin = 10;
            const maxX = window.innerWidth - element.offsetWidth - margin;
            const maxY = window.innerHeight - element.offsetHeight - margin;
            
            const newX = Math.max(margin, Math.min(maxX, initialX + deltaX));
            const newY = Math.max(margin, Math.min(maxY, initialY + deltaY));
            
            element.style.left = newX + 'px';
            element.style.top = newY + 'px';
            
            e.preventDefault();
        }
        
        function handleEnd(e) {
            if (dragTimeout) {
                clearTimeout(dragTimeout);
                dragTimeout = null;
            }
            
            if (isDragging) {
                isDragging = false;
                element.style.zIndex = '99999';
            }
        }
        
        // Mouse events
        element.addEventListener('mousedown', handleStart);
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleEnd);
        
        // Touch events for mobile with better support
        element.addEventListener('touchstart', handleStart, { passive: false });
        document.addEventListener('touchmove', handleMove, { passive: false });
        document.addEventListener('touchend', handleEnd);
        document.addEventListener('touchcancel', handleEnd);
    }
    
    // Global socket instance
    let globalSocket = null;
    
    function getSocket() {
        if (!globalSocket && typeof io !== 'undefined') {
            globalSocket = io();
            fetch('/api/auth/me')
                .then(response => response.json())
                .then(userData => {
                    globalSocket.emit('authenticate', userData.user._id);
                })
                .catch(() => {});
        }
        return globalSocket;
    }

    // Accept incoming call
    window.acceptCall = async function() {
        if (!activeCall || activeCall.type !== 'incoming') return;
        
        try {
            const webrtcReady = await initializeWebRTC();
            if (!webrtcReady) return;
            
            // Set remote description first if we have the offer
            if (activeCall.offer && peerConnection.signalingState === 'stable') {
                await peerConnection.setRemoteDescription(activeCall.offer);
            }
            
            // Check if we're in the right state to create an answer
            if (peerConnection.signalingState !== 'have-remote-offer') {
                console.error('Cannot create answer, wrong signaling state:', peerConnection.signalingState);
                return;
            }
            
            const socket = getSocket();
            
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            socket.emit('answer-call', {
                callerId: activeCall.callerId,
                answer: answer
            });
            
            activeCall.status = 'active';
            saveCallState(activeCall);
            showCallNotification(activeCall);
            
        } catch (error) {
            console.error('Failed to accept call:', error);
            alert('Failed to accept call. Please try again.');
        }
    };
    
    // Decline incoming call
    window.declineCall = function() {
        if (!activeCall || activeCall.type !== 'incoming') return;
        
        const callerId = activeCall.callerId;
        
        // Hide notification immediately
        hideCallNotification();
        
        // Send decline signal
        const socket = getSocket();
        if (socket && callerId) {
            socket.emit('call-declined', { callerId: callerId });
        }
    };
    
    // Mute/unmute functionality
    window.toggleMute = function() {
        let stream = localStream;
        
        // If no local stream in notification system, check display.js
        if (!stream && window.parent && window.parent.localStream) {
            stream = window.parent.localStream;
        } else if (!stream && window.localStream) {
            stream = window.localStream;
        }
        
        if (stream) {
            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                isMuted = !audioTrack.enabled;
                
                const muteBtn = document.getElementById('muteBtn');
                if (muteBtn) {
                    muteBtn.textContent = isMuted ? '🔇 Unmute' : '🎤 Mute';
                    muteBtn.style.background = isMuted ? '#dc3545' : '#6c757d';
                }
            }
        }
    };
    
    // Enhanced speaker toggle functionality for iPhone
    let isSpeakerOn = false;
    window.toggleSpeaker = function() {
        let audioElement = remoteAudio;
        
        // Find remote audio element with multiple fallbacks
        if (!audioElement) {
            audioElement = document.getElementById('remoteAudio');
        }
        if (!audioElement) {
            audioElement = document.querySelector('audio[id*="remote"]');
        }
        if (!audioElement) {
            // Look for any audio element with srcObject
            const audioElements = document.querySelectorAll('audio');
            for (let audio of audioElements) {
                if (audio.srcObject && !audio.muted) {
                    audioElement = audio;
                    break;
                }
            }
        }
        
        if (audioElement) {
            isSpeakerOn = !isSpeakerOn;
            
            console.log('Toggling speaker for iPhone:', isSpeakerOn ? 'ON' : 'OFF');
            
            // Enhanced iPhone audio handling
            if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                // Force unmute and set volume
                audioElement.muted = false;
                audioElement.volume = isSpeakerOn ? 1.0 : 0.7;
                
                // Force reload and play for iPhone
                audioElement.load();
                
                // Multiple play attempts for iPhone reliability
                const playAudio = async () => {
                    try {
                        await audioElement.play();
                        console.log('iPhone speaker audio playing');
                        
                        // Verify it's actually playing
                        setTimeout(() => {
                            if (audioElement.paused) {
                                console.log('iPhone audio paused, retrying...');
                                audioElement.play().catch(console.error);
                            }
                        }, 200);
                        
                    } catch (e) {
                        console.log('iPhone speaker play failed:', e);
                        
                        // Show alert for user interaction
                        alert('Please tap the screen to enable speaker audio');
                        
                        // Add interaction listener
                        const enableSpeaker = () => {
                            audioElement.play().then(() => {
                                console.log('iPhone speaker enabled after interaction');
                            }).catch(console.error);
                            document.removeEventListener('touchstart', enableSpeaker);
                            document.removeEventListener('click', enableSpeaker);
                        };
                        
                        document.addEventListener('touchstart', enableSpeaker, { once: true });
                        document.addEventListener('click', enableSpeaker, { once: true });
                    }
                };
                
                // Delay for iPhone
                setTimeout(playAudio, 100);
                
            } else {
                // Standard desktop handling
                audioElement.volume = isSpeakerOn ? 1.0 : 0.5;
                audioElement.muted = false;
                audioElement.play().catch(e => console.log('Speaker toggle play failed:', e));
            }
            
            // Update button appearance
            const speakerBtn = document.getElementById('speakerBtn');
            if (speakerBtn) {
                speakerBtn.textContent = isSpeakerOn ? '🔊 ON' : '🔊 Speaker';
                speakerBtn.style.background = isSpeakerOn ? '#28a745' : '#17a2b8';
            }
            
            console.log('Speaker toggled:', isSpeakerOn ? 'ON' : 'OFF');
        } else {
            console.log('No audio element found for speaker toggle');
            alert('No active audio found. Please ensure you are in an active call.');
        }
    };
    
    // End active call
    window.endCall = function() {
        const socket = getSocket();
        let targetId = null;
        
        // Check if we have an active call in the notification system
        if (activeCall) {
            targetId = activeCall.type === 'incoming' ? activeCall.callerId : activeCall.recipientId;
        }
        // Check for display.js call in parent window
        else if (window.parent && window.parent.currentCall) {
            targetId = window.parent.currentCall.recipientId;
        }
        // Check current window for display.js call
        else if (window.currentCall) {
            targetId = window.currentCall.recipientId;
        }
        
        // Immediately hide notification and clean up
        hideCallNotification();
        
        // Clean up display.js call if exists
        if (window.parent && typeof window.parent.cleanupCall === 'function') {
            window.parent.cleanupCall();
        }
        if (typeof window.cleanupCall === 'function') {
            window.cleanupCall();
        }
        
        // Send end call signal immediately without delay
        if (targetId && socket) {
            socket.emit('end-call', { targetId: targetId });
        }
    };

    // Make call function
    window.makeCall = async function(recipientId, recipientName) {
        try {
            const response = await fetch('/api/auth/me');
            const userData = await response.json();
            const socket = getSocket();

            const webrtcReady = await initializeWebRTC();
            if (!webrtcReady) return;

            socket.emit('authenticate', userData.user._id);
            
            setTimeout(async () => {
                try {
                    const offer = await peerConnection.createOffer();
                    await peerConnection.setLocalDescription(offer);
                    
                    socket.emit('call-user', {
                        recipientId: recipientId,
                        callerName: `${userData.user.firstName} ${userData.user.lastName}`,
                        callerId: userData.user._id,
                        callerEmail: userData.user.email,
                        offer: offer
                    });
                } catch (error) {
                    console.error('Failed to create offer:', error);
                }
            }, 200);

            const callData = {
                type: 'outgoing',
                name: recipientName,
                counter: 'Unknown',
                service: 'Calling...',
                callId: userData.user._id + '_' + Date.now(),
                recipientId: recipientId
            };
            
            showCallNotification(callData);
        } catch (error) {
            console.error('Call failed:', error);
        }
    };

    // Socket event listeners
    function setupSocketListeners() {
        const socket = getSocket();
        if (!socket) return;
        
        fetch('/api/auth/me')
            .then(response => {
                if (response.ok) {
                    return response.json();
                }
                throw new Error('Not authenticated');
            })
            .then(userData => {
                socket.emit('authenticate', userData.user._id);
            })
            .catch(() => {}); // Silently handle auth failures
        
        socket.on('incoming-call', async function(data) {
            // Don't show incoming call notifications in display screen iframe
            if (window.location.pathname === '/display' && window.self !== window.top) {
                return;
            }
            
            const callData = {
                type: 'incoming',
                name: data.callerName,
                counter: data.callerCounter || 'Unknown',
                service: data.callerService || 'Incoming call...',
                callId: data.callerId,
                callerId: data.callerId,
                offer: data.offer
            };
            
            showCallNotification(callData);
        });
        
        socket.on('call-answered', async function(data) {
            if (peerConnection && data.answer) {
                try {
                    if (peerConnection.signalingState === 'have-local-offer') {
                        await peerConnection.setRemoteDescription(data.answer);
                        
                        if (activeCall) {
                            activeCall.status = 'active';
                            saveCallState(activeCall);
                            showCallNotification(activeCall);
                        }
                    }
                } catch (error) {
                    console.error('Failed to set remote description:', error);
                }
            }
        });
        
        socket.on('ice-candidate', async function(candidate) {
            if (peerConnection && candidate) {
                try {
                    await peerConnection.addIceCandidate(candidate);
                } catch (error) {
                    console.error('Error adding ICE candidate:', error);
                }
            }
        });

        socket.on('call-ended', function() {
            if (activeCall && activeCall.status === 'active') {
                // Show notification that call was ended by the other party
                const otherPartyName = activeCall.name || 'The other party';
                if (typeof window.notifications !== 'undefined') {
                    window.notifications.info('Call Ended', `${otherPartyName} ended the call`);
                }
            }
            hideCallNotification();
        });
        socket.on('call-declined', function() {
            if (activeCall && activeCall.type === 'outgoing') {
                // Show notification that call was declined by the recipient
                const recipientName = activeCall.name || 'The user';
                if (typeof window.notifications !== 'undefined') {
                    window.notifications.info('Call Declined', `${recipientName} declined your call`);
                }
            }
            hideCallNotification();
        });
        socket.on('call-failed', hideCallNotification);
        socket.on('call-ended-disconnect', function() {
            if (activeCall && activeCall.status === 'active') {
                // Show notification that call was ended due to disconnection
                const otherPartyName = activeCall.name || 'The other party';
                if (typeof window.notifications !== 'undefined') {
                    window.notifications.info('Call Ended', `${otherPartyName} disconnected`);
                }
            }
            hideCallNotification();
        });
    }
    
    // Toggle minimize function
    window.toggleMinimize = function(notificationId) {
        const notification = document.getElementById(notificationId);
        if (!notification) return;
        
        const content = notification.querySelector('.notification-content');
        const minimizedContent = notification.querySelector('.minimized-content');
        const minimizeBtn = notification.querySelector('#minimizeBtn');
        
        if (content.style.display === 'none') {
            // Restore
            notification.style.height = 'auto';
            minimizeBtn.textContent = '−';
            content.style.display = 'block';
            minimizedContent.style.display = 'none';
        } else {
            // Minimize
            notification.style.height = '60px';
            minimizeBtn.textContent = '+';
            content.style.display = 'none';
            minimizedContent.style.display = 'block';
        }
    };
    
    // Global functions
    window.showCallNotification = showCallNotification;
    window.hideCallNotification = hideCallNotification;
    window.loadCallState = loadCallState;
    window.saveCallState = saveCallState;
    window.clearCallState = clearCallState;
    
    window.showOutgoingCallNotification = function(recipientName, counter, service, recipientId) {
        const callData = {
            type: 'outgoing',
            name: recipientName,
            counter: counter || 'Unknown',
            service: service || 'Unknown Service',
            recipientId: recipientId
        };
        // Store the call data for end call functionality
        activeCall = callData;
        showCallNotification(callData);
    };
    
    window.showCallNotificationOnParent = function(callData) {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'showCallNotification',
                callData: callData
            }, '*');
        } else {
            // If not in iframe, show locally
            showCallNotification(callData);
        }
    };
    
    window.hideCallNotificationOnParent = function() {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'hideCallNotification'
            }, '*');
        } else {
            // If not in iframe, hide locally
            hideCallNotification();
        }
    };
    
    window.unfoldDisplayScreenOnParent = function() {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'unfoldDisplayScreen'
            }, '*');
        }
    };
    
    window.hasActiveCall = function() {
        const savedCall = loadCallState();
        return savedCall !== null;
    };
    
    window.getActiveCall = function() {
        return loadCallState();
    };
    
    // Initialize
    setupSocketListeners();
    
    // Restore call state on page load
    document.addEventListener('DOMContentLoaded', function() {
        const savedCall = loadCallState();
        if (savedCall) {
            showCallNotification(savedCall);
        }
    });
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            const savedCall = loadCallState();
            if (savedCall && !currentNotification) {
                showCallNotification(savedCall);
            }
        }
    });
    
    // Handle messages from iframe (display screen)
    window.addEventListener('message', function(event) {
        if (event.data.type === 'showCallNotification') {
            showCallNotification(event.data.callData);
        } else if (event.data.type === 'hideCallNotification') {
            hideCallNotification();
        }
    });
})();