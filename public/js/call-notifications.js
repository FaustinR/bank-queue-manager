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
    
    // Create audio elements with comprehensive mobile compatibility
    function createAudioElements() {
        if (!remoteAudio) {
            remoteAudio = document.createElement('audio');
            remoteAudio.id = 'remoteCallAudio';
            remoteAudio.autoplay = false; // Start false for iOS
            remoteAudio.controls = false;
            remoteAudio.playsInline = true;
            remoteAudio.muted = false;
            remoteAudio.volume = 1.0;
            remoteAudio.preload = 'auto';
            remoteAudio.setAttribute('playsinline', 'true');
            remoteAudio.setAttribute('webkit-playsinline', 'true');
            remoteAudio.style.display = 'none';
            document.body.appendChild(remoteAudio);
        }
        
        if (!localAudio) {
            localAudio = document.createElement('audio');
            localAudio.id = 'localCallAudio';
            localAudio.autoplay = false;
            localAudio.controls = false;
            localAudio.muted = true;
            localAudio.playsInline = true;
            localAudio.setAttribute('playsinline', 'true');
            localAudio.setAttribute('webkit-playsinline', 'true');
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
            // Failed to save call state
        }
    }
    
    // Clear call state
    function clearCallState() {
        activeCall = null;
        try {
            localStorage.removeItem(CALL_STORAGE_KEY);
        } catch (e) {}
    }

    // Initialize audio context for iOS
    let audioContext = null;
    function initAudioContext() {
        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                if (audioContext.state === 'suspended') {
                    audioContext.resume();
                }

            } catch (e) {
                // Audio context failed
            }
        }
    }
    
    // WebRTC initialization with audio support
    async function initializeWebRTC() {
        try {
            initAudioContext();
            createAudioElements();
            
            // Simple audio constraints for reliability
            const audioConstraints = {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            };
            
            // Try microphone with retry for multiple browser sessions
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount < maxRetries) {
                try {
                    localStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                            sampleRate: 44100
                        },
                        video: false
                    });

                    break;
                } catch (error) {
                    retryCount++;

                    
                    if (error.name === 'NotAllowedError') {
                        alert('Microphone access denied. Please allow microphone access and refresh the page.');
                        throw error;
                    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                        if (retryCount >= maxRetries) {
                            alert('Microphone is being used by another browser tab. Please close other tabs using the microphone and try again.');
                            throw error;
                        }
                        // Wait before retry
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } else {
                        alert('Failed to access microphone: ' + error.message);
                        throw error;
                    }
                }
            }
            
            // Set local audio stream (muted to prevent echo)
            if (localAudio) {
                localAudio.srcObject = localStream;
            }
            
            // Create peer connection with optimized STUN servers
            peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ],
                iceCandidatePoolSize: 4,
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require'
            });
            
            // Add local stream to peer connection
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
            
            // Handle remote stream
            peerConnection.ontrack = (event) => {

                remoteStream = event.streams[0];
                
                if (!remoteStream || remoteStream.getAudioTracks().length === 0) {
                    return;
                }
                

                
                // Remove existing audio element
                if (remoteAudio) {
                    remoteAudio.remove();
                }
                
                // Create hidden audio element with autoplay
                remoteAudio = document.createElement('audio');
                remoteAudio.autoplay = true;
                remoteAudio.controls = false;
                remoteAudio.playsInline = true;
                remoteAudio.volume = 1.0;
                remoteAudio.muted = false;
                remoteAudio.setAttribute('playsinline', 'true');
                remoteAudio.setAttribute('webkit-playsinline', 'true');
                remoteAudio.style.display = 'none';
                document.body.appendChild(remoteAudio);
                
                // Set stream and make globally accessible
                remoteAudio.srcObject = remoteStream;
                window.remoteAudio = remoteAudio;
                

                
                // Force play for better compatibility
                setTimeout(() => {
                    remoteAudio.play().then(() => {
                        // Audio playing automatically
                    }).catch(e => {
                        showAudioEnableButton();
                    });
                }, 100);
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
    
    // Debug function to check audio state
    window.debugAudio = function() {
        // Debug function for audio state
        const audioElement = window.remoteAudio || remoteAudio;
        return {
            remoteAudio: !!remoteAudio,
            windowRemoteAudio: !!window.remoteAudio,
            remoteStream: !!remoteStream,
            audioElement: !!audioElement,
            srcObject: audioElement ? !!audioElement.srcObject : false,
            volume: audioElement ? audioElement.volume : null,
            muted: audioElement ? audioElement.muted : null,
            paused: audioElement ? audioElement.paused : null,
            readyState: audioElement ? audioElement.readyState : null
        };
    };
    
    // Show button to enable audio if auto-play is blocked
    function showAudioEnableButton() {
        if (currentNotification && !currentNotification.querySelector('.enable-audio-btn')) {
            const enableBtn = document.createElement('button');
            enableBtn.className = 'enable-audio-btn';
            enableBtn.textContent = '🔊 Tap to Enable Audio';
            enableBtn.style.cssText = 'background: #ff6b35; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; margin: 10px auto; display: block; font-size: 16px; font-weight: bold;';
            enableBtn.onclick = () => {
                const audioElement = window.remoteAudio || remoteAudio;
                
                if (audioElement && audioElement.srcObject) {
                    audioElement.play().then(() => {
                        enableBtn.remove();
                    }).catch(e => {
                        enableBtn.textContent = '❌ Audio Failed - Check Settings';
                    });
                } else {
                    enableBtn.textContent = '❌ No Audio Stream';
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
            // Initialize audio context on user interaction
            initAudioContext();
            
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
    
    // Speaker toggle with debugging
    let isSpeakerOn = false;
    window.toggleSpeaker = function() {
        const audioElement = window.remoteAudio || remoteAudio;
        
        if (audioElement) {
            if (audioElement.srcObject) {
                isSpeakerOn = !isSpeakerOn;
                audioElement.volume = isSpeakerOn ? 1.0 : 0.5;
                audioElement.muted = false;
                
                audioElement.play().then(() => {
                    // Audio play successful
                }).catch(e => {
                    showAudioEnableButton();
                });
                
                const speakerBtn = document.getElementById('speakerBtn');
                if (speakerBtn) {
                    speakerBtn.textContent = isSpeakerOn ? '🔊 ON' : '🔊 Speaker';
                    speakerBtn.style.background = isSpeakerOn ? '#28a745' : '#17a2b8';
                }
            } else {
                alert('No audio stream found');
            }
        } else {
            alert('No audio element found');
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
            // Initialize audio context on user interaction
            initAudioContext();
            
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