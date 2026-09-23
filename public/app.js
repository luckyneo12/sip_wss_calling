/**
 * Tata WebRTC SIP Dialer
 * Powered by JsSIP & WebRTC
 * Pre-configured for: Extension 406 | Server 103.9.14.223 | Secret GSM123ext
 */

(function () {
  'use strict';

  // --- State Variables ---
  let ua = null;
  let currentSession = null;
  let callTimerInterval = null;
  let callSeconds = 0;
  let isMuted = false;
  let isOnHold = false;
  let audioContext = null;

  // --- DOM Elements ---
  const statusPill = document.getElementById('statusPill');
  const statusText = document.getElementById('statusText');
  const activeExtBadge = document.getElementById('activeExtBadge');
  const activeHostBadge = document.getElementById('activeHostBadge');
  const btnToggleConnect = document.getElementById('btnToggleConnect');

  const phoneInput = document.getElementById('phoneInput');
  const btnClearInput = document.getElementById('btnClearInput');
  const dialpadButtons = document.querySelectorAll('.key-btn');
  const btnCall = document.getElementById('btnCall');
  const btnHangup = document.getElementById('btnHangup');
  const inCallControls = document.getElementById('inCallControls');
  const btnMute = document.getElementById('btnMute');
  const btnHold = document.getElementById('btnHold');
  const callDuration = document.getElementById('callDuration');

  const logStream = document.getElementById('logStream');
  const btnClearLogs = document.getElementById('btnClearLogs');
  const btnCopyLogs = document.getElementById('btnCopyLogs');

  // Modals & Config Triggers
  const btnEditConfig = document.getElementById('btnEditConfig');
  const accountInfoClickable = document.getElementById('accountInfoClickable');
  const btnUseHostBridge = document.getElementById('btnUseHostBridge');
  const settingsModal = document.getElementById('settingsModal');
  const btnOpenSettings = document.getElementById('btnOpenSettings');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const settingsForm = document.getElementById('settingsForm');
  const cfgExt = document.getElementById('cfgExt');
  const cfgPass = document.getElementById('cfgPass');
  const cfgDomain = document.getElementById('cfgDomain');
  const cfgPreset = document.getElementById('cfgPreset');
  const cfgWss = document.getElementById('cfgWss');
  const cfgDisplayName = document.getElementById('cfgDisplayName');
  const btnTestWss = document.getElementById('btnTestWss');

  const diagModal = document.getElementById('diagModal');
  const btnRunDiagnostics = document.getElementById('btnRunDiagnostics');
  const btnCloseDiag = document.getElementById('btnCloseDiag');
  const btnRerunDiag = document.getElementById('btnRerunDiag');
  const diagHostLabel = document.getElementById('diagHostLabel');
  const diagLoading = document.getElementById('diagLoading');
  const diagResults = document.getElementById('diagResults');
  const diagTableBody = document.getElementById('diagTableBody');
  const diagRecommendation = document.getElementById('diagRecommendation');
  const directCertLink = document.getElementById('directCertLink');

  const incomingModal = document.getElementById('incomingModal');
  const incomingCaller = document.getElementById('incomingCaller');
  const btnAnswerCall = document.getElementById('btnAnswerCall');
  const btnRejectCall = document.getElementById('btnRejectCall');
  let incomingSession = null;

  const remoteAudio = document.getElementById('remoteAudio');

  // DTMF Frequencies (Row x Col)
  const dtmfFrequencies = {
    '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
    '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
    '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
    '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
  };

  // --- Initialize Audio Context for DTMF & Tones ---
  function getAudioContext() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
      }
    }
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }
    return audioContext;
  }

  function playDtmfTone(digit) {
    const freqs = dtmfFrequencies[digit];
    if (!freqs) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.value = freqs[0];
      osc2.frequency.value = freqs[1];

      gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.16);
      osc2.stop(ctx.currentTime + 0.16);
    } catch (e) {
      console.warn('Audio tone error:', e);
    }
  }

  // --- Ringback and Incoming Tones ---
  let ringbackTimer = null;
  function startRingbackTone() {
    stopRingbackTone();
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const playBeep = () => {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.frequency.value = 440;
        osc2.frequency.value = 480;
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 1.8);
        osc2.stop(ctx.currentTime + 1.8);
      };
      playBeep();
      ringbackTimer = setInterval(playBeep, 4000);
    } catch(e) {}
  }

  function stopRingbackTone() {
    if (ringbackTimer) {
      clearInterval(ringbackTimer);
      ringbackTimer = null;
    }
  }

  let incomingRingtoneTimer = null;
  function startIncomingRingtone() {
    stopIncomingRingtone();
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const playRing = () => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(750, ctx.currentTime);
        osc.frequency.setValueAtTime(850, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 1.2);
      };
      playRing();
      incomingRingtoneTimer = setInterval(playRing, 3000);
    } catch(e) {}
  }

  function stopIncomingRingtone() {
    if (incomingRingtoneTimer) {
      clearInterval(incomingRingtoneTimer);
      incomingRingtoneTimer = null;
    }
  }

  // --- Reliable Audio Stream Provider (Microphone with Virtual Fallback) ---
  async function getAudioStream() {
    // 1. Try real microphone
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
        addLog('MIC', 'Microphone stream captured successfully.', 'info');
        return stream;
      } catch (err) {
        addLog('MIC', `⚠️ Direct microphone capture blocked (${err.name}: ${err.message}). Using virtual audio track fallback so call can proceed.`, 'warn');
      }
    } else {
      addLog('MIC', '⚠️ navigator.mediaDevices unavailable (non-HTTPS origin). Using virtual audio track.', 'warn');
    }

    // 2. Fallback: Virtual Web Audio stream so SDP offer can be created without blocking
    try {
      const ctx = getAudioContext();
      if (ctx) {
        const osc = ctx.createOscillator();
        const dst = ctx.createMediaStreamDestination();
        const gain = ctx.createGain();
        gain.gain.value = 0.0001; // Silent audio
        osc.connect(gain);
        gain.connect(dst);
        osc.start();
        return dst.stream;
      }
    } catch(e) {
      console.warn('Virtual stream error:', e);
    }
    return null;
  }

  // --- Logger Utility ---
  function addLog(tag, message, type = 'info') {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

    const entry = document.createElement('div');
    entry.className = 'log-entry';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = timeStr;

    const tagSpan = document.createElement('span');
    tagSpan.className = `log-tag tag-${type}`;
    tagSpan.textContent = tag;

    const msgSpan = document.createElement('span');
    msgSpan.className = 'log-msg';
    msgSpan.textContent = message;

    entry.appendChild(timeSpan);
    entry.appendChild(tagSpan);
    entry.appendChild(msgSpan);

    logStream.appendChild(entry);
    logStream.scrollTop = logStream.scrollHeight;
  }

  // Intercept JsSIP debug logs to display in UI console
  if (window.JsSIP && window.JsSIP.debug) {
    window.JsSIP.debug.enable('JsSIP:*');
    // Also attach custom interceptor if available
  }

  // --- Update UI Connection Status ---
  function setConnectionStatus(state, label) {
    statusPill.className = `status-pill status-${state}`;
    statusText.textContent = label;

    if (state === 'registered') {
      btnToggleConnect.textContent = 'Unregister';
      btnToggleConnect.className = 'btn-sm btn-connected';
    } else if (state === 'connecting') {
      btnToggleConnect.textContent = 'Connecting...';
      btnToggleConnect.className = 'btn-sm btn-connect';
    } else {
      btnToggleConnect.textContent = 'Register';
      btnToggleConnect.className = 'btn-sm btn-connect';
    }
  }

  // --- Load Settings from LocalStorage or Defaults ---
  function loadSettings() {
    const defaultUrl = getDefaultWssUrl();
    const saved = localStorage.getItem('tata_sip_cfg');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        cfgExt.value = data.ext || '406';
        cfgPass.value = data.pass || 'GSM123ext';
        cfgDomain.value = data.domain || '103.9.14.223';
        // Auto-migrate from unreachable 8089 to server's live bridge
        if (!data.wss || data.wss.includes(':8089/ws')) {
          cfgWss.value = defaultUrl;
        } else {
          cfgWss.value = data.wss;
        }
        cfgDisplayName.value = data.displayName || 'Tata Ext 406';
      } catch (e) {
        cfgWss.value = defaultUrl;
      }
    } else {
      cfgWss.value = defaultUrl;
    }
    updateAccountHeader();
  }

  function getDefaultWssUrl() {
    const loc = window.location;
    const domain = (cfgDomain && cfgDomain.value.trim()) || '103.9.14.223';
    if (loc.protocol === 'http:' || loc.protocol === 'https:') {
      const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${loc.host}/sip-bridge?target=${encodeURIComponent(domain)}`;
    }
    return `ws://localhost:3000/sip-bridge?target=${encodeURIComponent(domain)}`;
  }

  function saveSettings() {
    const data = {
      ext: cfgExt.value.trim(),
      pass: cfgPass.value.trim(),
      domain: cfgDomain.value.trim(),
      wss: cfgWss.value.trim(),
      displayName: cfgDisplayName.value.trim()
    };
    localStorage.setItem('tata_sip_cfg', JSON.stringify(data));
    updateAccountHeader();
    return data;
  }

  function updateAccountHeader() {
    activeExtBadge.textContent = `Ext: ${cfgExt.value.trim()}`;
    activeHostBadge.textContent = `@ ${cfgDomain.value.trim()}`;
    diagHostLabel.textContent = cfgDomain.value.trim();
    directCertLink.href = cfgWss.value.trim().replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:');
    directCertLink.textContent = directCertLink.href;
  }

  // --- Preset Dropdown Change ---
  cfgPreset.addEventListener('change', () => {
    if (cfgPreset.value !== 'custom') {
      cfgWss.value = cfgPreset.value;
    }
  });

  // --- JsSIP User Agent Initialization ---
  function initializeUA() {
    const ext = cfgExt.value.trim();
    const pass = cfgPass.value.trim();
    const domain = cfgDomain.value.trim();
    const wssUrl = cfgWss.value.trim();
    const displayName = cfgDisplayName.value.trim();

    if (!ext || !pass || !domain || !wssUrl) {
      addLog('CONFIG', 'Missing extension, password, domain, or WebSocket URL.', 'error');
      setConnectionStatus('error', 'Config Error');
      return;
    }

    // Stop existing UA if active without letting its 2s timer kill new connections
    if (ua) {
      try {
        if (ua._closeTimer) {
          clearTimeout(ua._closeTimer);
          ua._closeTimer = null;
        }
        if (ua._transport) {
          ua._transport.close_requested = true;
          if (ua._transport.socket) {
            ua._transport.socket.onconnect = () => {};
            ua._transport.socket.ondisconnect = () => {};
            ua._transport.socket.ondata = () => {};
            try { ua._transport.socket.disconnect(); } catch(e) {}
          }
        }
        ua.stop();
        if (ua._closeTimer) {
          clearTimeout(ua._closeTimer);
          ua._closeTimer = null;
        }
      } catch (e) {}
      ua = null;
    }

    addLog('INIT', `Starting JsSIP for ${ext}@${domain} via ${wssUrl}`, 'info');
    setConnectionStatus('connecting', 'Connecting...');

    try {
      const socket = new JsSIP.WebSocketInterface(wssUrl);
      
      const configuration = {
        sockets: [socket],
        uri: `sip:${ext}@${domain}`,
        password: pass,
        display_name: displayName,
        register: true,
        register_expires: 300,
        session_timers: false,
        connection_recovery_min_interval: 2,
        connection_recovery_max_interval: 10
      };

      ua = new JsSIP.UA(configuration);

      // Event: Transport connecting
      ua.on('connecting', (e) => {
        addLog('WSS', `Opening WebSocket connection to ${wssUrl}...`, 'info');
        setConnectionStatus('connecting', 'Connecting...');
      });

      // Event: Transport connected
      ua.on('connected', (e) => {
        addLog('WSS', `WebSocket connected! Transport is open. Sending REGISTER...`, 'success');
        setConnectionStatus('connecting', 'Registering...');
      });

      // Event: Transport disconnected
      ua.on('disconnected', (e) => {
        const errorMsg = e.error ? ` (Error: ${e.error})` : '';
        addLog('WSS', `WebSocket disconnected (code: ${e.code}, reason: ${e.reason || 'None'})${errorMsg}`, 'error');
        setConnectionStatus('disconnected', 'Disconnected');
        
        // Provide hint if port / certificate failed
        if (wssUrl.startsWith('wss://') && !e.wasClean) {
          addLog('HINT', 'If using direct WSS (e.g. port 8089), browser may be blocking an untrusted or expired SSL cert. Click Diagnostics or open the WSS link directly in Chrome to accept the cert.', 'warn');
        }

        // Auto-reconnect if dropped unexpectedly
        if (ua && !ua._user_closed) {
          setTimeout(() => {
            if (ua && !ua.isConnected() && !ua.isConnecting()) {
              addLog('WSS', 'Re-connecting to bridge...', 'info');
              ua.start();
            }
          }, 1500);
        }
      });

      // Event: Registered successfully
      ua.on('registered', (e) => {
        addLog('SIP', `✅ REGISTER 200 OK! Extension ${ext} successfully registered on ${domain}!`, 'success');
        setConnectionStatus('registered', `Registered (${ext})`);
      });

      // Event: Unregistered
      ua.on('unregistered', (e) => {
        addLog('SIP', `Extension ${ext} unregistered.`, 'warn');
        setConnectionStatus('disconnected', 'Unregistered');
      });

      // Event: Registration failed
      ua.on('registrationFailed', (e) => {
        let details = e.cause || 'Unknown Error';
        if (e.response) {
          details = `${e.response.status_code} ${e.response.reason_phrase}`;
        }
        addLog('AUTH', `❌ Registration failed: ${details}`, 'error');
        setConnectionStatus('error', 'Auth Failed');

        if (e.response && e.response.status_code === 401) {
          addLog('HELP', '401 Unauthorized: Check SIP password or username.', 'warn');
        } else if (e.response && e.response.status_code === 403) {
          addLog('HELP', '403 Forbidden: Extension not allowed or IP restricted by server firewall.', 'warn');
        }
      });

      // Event: Incoming/Outgoing Call Session
      ua.on('newRTCSession', (e) => {
        const session = e.session;

        if (session.direction === 'incoming') {
          handleIncomingCall(session);
        } else {
          handleOutgoingCall(session);
        }
      });

      // Start the UA
      ua.start();

      // Send CRLF keep-alive every 10s to keep connection alive indefinitely
      if (window._sipKeepAliveTimer) clearInterval(window._sipKeepAliveTimer);
      window._sipKeepAliveTimer = setInterval(() => {
        if (ua && ua.isConnected()) {
          try {
            socket.send('\r\n\r\n');
          } catch(e) {}
        }
      }, 10000);

    } catch (err) {
      addLog('ERROR', `Failed to initialize JsSIP: ${err.message}`, 'error');
      setConnectionStatus('error', 'Init Error');
    }
  }

  // --- Outgoing Call Handler ---
  function handleOutgoingCall(session) {
    currentSession = session;
    const target = session.remote_identity.uri.user || phoneInput.value.trim();

    addLog('CALL', `Calling ${target}... [INVITE sent]`, 'sip-send');
    updateCallUIState('calling');

    attachSessionEvents(session);
  }

  // --- Incoming Call Handler ---
  function handleIncomingCall(session) {
    incomingSession = session;
    const caller = session.remote_identity.display_name || session.remote_identity.uri.user || 'Unknown Caller';
    
    addLog('CALL', `🔔 Incoming call from: ${caller}`, 'warn');
    incomingCaller.textContent = caller;
    incomingModal.classList.remove('hidden');
    startIncomingRingtone();

    session.on('ended', () => {
      stopIncomingRingtone();
      incomingModal.classList.add('hidden');
      incomingSession = null;
      addLog('CALL', 'Incoming call ended by caller', 'info');
    });

    session.on('failed', () => {
      stopIncomingRingtone();
      incomingModal.classList.add('hidden');
      incomingSession = null;
      addLog('CALL', 'Incoming call failed / cancelled', 'error');
    });
  }

  // Answer incoming call
  btnAnswerCall.addEventListener('click', async () => {
    if (incomingSession) {
      stopIncomingRingtone();
      incomingModal.classList.add('hidden');
      currentSession = incomingSession;
      incomingSession = null;

      const stream = await getAudioStream();
      const options = {
        mediaConstraints: { audio: true, video: false }
      };
      if (stream) {
        options.mediaStream = stream;
      }

      currentSession.answer(options);
      attachSessionEvents(currentSession);
      updateCallUIState('connected');
      addLog('CALL', 'Call answered.', 'success');
    }
  });

  // Reject incoming call
  btnRejectCall.addEventListener('click', () => {
    if (incomingSession) {
      stopIncomingRingtone();
      incomingModal.classList.add('hidden');
      incomingSession.terminate({ status_code: 486, reason_phrase: 'Busy Here' });
      incomingSession = null;
      addLog('CALL', 'Call rejected.', 'warn');
    }
  });

  // --- Attach Session Event Listeners ---
  function attachSessionEvents(session) {
    // WebRTC PeerConnection setup
    session.on('peerconnection', (e) => {
      const pc = session.connection;
      addLog('WEBRTC', 'PeerConnection created. Negotiating ICE & SRTP...', 'info');

      // Guard against duplicate 183 SDP answers from Asterisk triggering "Called in wrong state: stable"
      const origSetRemoteDescription = pc.setRemoteDescription.bind(pc);
      pc.setRemoteDescription = function(desc) {
        if (desc && desc.type === 'answer' && pc.signalingState === 'stable') {
          console.log('[WebRTC Guard] Ignored duplicate SDP answer in stable state.');
          return Promise.resolve();
        }
        return origSetRemoteDescription(desc);
      };

      pc.ontrack = (event) => {
        addLog('AUDIO', 'Remote audio stream received!', 'success');
        if (remoteAudio.srcObject !== event.streams[0]) {
          remoteAudio.srcObject = event.streams[0];
          remoteAudio.play().catch(e => console.warn('Autoplay prevented:', e));
        }
      };

      pc.oniceconnectionstatechange = () => {
        addLog('ICE', `ICE Connection State: ${pc.iceConnectionState}`, pc.iceConnectionState === 'connected' ? 'success' : 'info');
      };
    });

    session.on('connecting', () => {
      addLog('SIP', `Connecting... [INVITE sent to server]`, 'sip-send');
    });

    session.on('sending', () => {
      addLog('SIP', `Sending SDP Offer to destination...`, 'sip-send');
    });

    // Call Progress (180 Ringing, 183 Session Progress)
    session.on('progress', (e) => {
      const code = e.response ? e.response.status_code : '18x';
      addLog('SIP', `🔔 Call Progress: ${code} Ringing! Destination phone is ringing...`, 'sip-recv');
      setConnectionStatus('calling', 'Ringing...');
      startRingbackTone();
    });

    // Call Accepted (200 OK)
    session.on('accepted', (e) => {
      stopRingbackTone();
      addLog('SIP', '🎉 Call Answered! 200 OK received.', 'success');
      updateCallUIState('connected');
      startCallTimer();
    });

    // Call Confirmed (ACK)
    session.on('confirmed', (e) => {
      addLog('CALL', 'Call in active progress.', 'info');
    });

    // Call Ended (BYE)
    session.on('ended', (e) => {
      stopRingbackTone();
      addLog('CALL', `Call ended (${e.cause || 'Normal Clearing'}).`, 'warn');
      cleanupCallUI();
    });

    // Call Failed (Busy, Reject, Error)
    session.on('failed', (e) => {
      stopRingbackTone();
      let cause = e.cause || 'Unknown Failure';
      if (e.response) cause = `${e.response.status_code} ${e.response.reason_phrase}`;
      addLog('CALL', `Call failed: ${cause}`, 'error');
      cleanupCallUI();
    });

    session.on('peerconnection:setremotedescriptionfailed', (err) => {
      const msg = err.message || String(err);
      if (msg.includes('Called in wrong state: stable')) {
        console.log('[WebRTC] Ignored duplicate 183 SDP transition:', msg);
        return;
      }
      addLog('WEBRTC', `❌ setRemoteDescription Failed: ${msg}`, 'error');
      if (msg.includes('fingerprint')) {
        addLog('HELP', 'Asterisk extension requires DTLS-SRTP. In FreePBX: Extension -> Advanced -> Enable DTLS: Yes, Media Encryption: DTLS-SRTP, Use AVPF: Yes.', 'warn');
      }
    });

    // Inspect and auto-repair remote SDP from Asterisk to ensure browser compatibility
    session.on('sdp', (e) => {
      if (e.originator === 'remote' && e.type === 'answer') {
        let sdp = e.sdp;
        console.log('[Remote SDP Answer from PBX]:\n' + sdp);
        const hasFingerprint = sdp.includes('a=fingerprint:');
        const hasRtcpMux = sdp.includes('a=rtcp-mux');
        const mediaMatch = sdp.match(/m=audio[^\r\n]+/);
        const mediaLine = mediaMatch ? mediaMatch[0] : 'm=audio';

        // Repair 1: Auto-inject rtcp-mux if Asterisk omitted it
        if (!hasRtcpMux && sdp.includes('m=audio')) {
          sdp = sdp.replace(/(m=audio[^\r\n]+[\r\n]+)/, '$1a=rtcp-mux\r\n');
        }
        // Repair 2: Chrome rejects a=setup:actpass in an Answer; convert to passive
        if (sdp.includes('a=setup:actpass')) {
          sdp = sdp.replace(/a=setup:actpass/g, 'a=setup:passive');
        }
        // Repair 3: Ensure a=mid is present if bundled
        if (!sdp.includes('a=mid:') && sdp.includes('m=audio')) {
          sdp = sdp.replace(/(m=audio[^\r\n]+[\r\n]+)/, '$1a=mid:0\r\n');
        }
        e.sdp = sdp;

        if (!hasFingerprint) {
          addLog('SDP-ALERT', `⚠️ Remote SDP lacks DTLS fingerprint (${mediaLine}). Asterisk sent plain unencrypted RTP!`, 'error');
          addLog('FIX', 'To fix this: In FreePBX -> Extension 8101 -> Advanced -> Enable DTLS: Yes, Media Encryption: DTLS-SRTP', 'warn');
        } else {
          addLog('SDP', `Answer received with valid DTLS fingerprint (${mediaLine})`, 'success');
        }
      }
    });

    session.on('getusermediafailed', (err) => {
      addLog('MIC', `Microphone access error: ${err.message}`, 'error');
    });
  }

  // --- Call UI Transitions ---
  function updateCallUIState(state) {
    if (state === 'calling' || state === 'connected') {
      btnCall.classList.add('hidden');
      btnHangup.classList.remove('hidden');
      inCallControls.classList.remove('hidden');
      setConnectionStatus('calling', state === 'calling' ? 'Calling...' : 'In Call');
    }
  }

  function cleanupCallUI() {
    stopRingbackTone();
    stopIncomingRingtone();
    stopCallTimer();
    currentSession = null;
    isMuted = false;
    isOnHold = false;
    btnMute.classList.remove('active');
    btnHold.classList.remove('active');

    btnHangup.classList.add('hidden');
    btnCall.classList.remove('hidden');
    inCallControls.classList.add('hidden');

    if (ua && ua.isRegistered()) {
      setConnectionStatus('registered', `Registered (${cfgExt.value.trim()})`);
    } else {
      setConnectionStatus('disconnected', 'Disconnected');
    }

    if (remoteAudio.srcObject) {
      remoteAudio.srcObject = null;
    }
  }

  // --- Call Timer ---
  function startCallTimer() {
    stopCallTimer();
    callSeconds = 0;
    callDuration.textContent = '00:00';
    callTimerInterval = setInterval(() => {
      callSeconds++;
      const mins = String(Math.floor(callSeconds / 60)).padStart(2, '0');
      const secs = String(callSeconds % 60).padStart(2, '0');
      callDuration.textContent = `${mins}:${secs}`;
    }, 1000);
  }

  function stopCallTimer() {
    if (callTimerInterval) {
      clearInterval(callTimerInterval);
      callTimerInterval = null;
    }
  }

  // --- Call Button (Dial) ---
  btnCall.addEventListener('click', async () => {
    const target = phoneInput.value.trim();
    if (!target) {
      addLog('DIAL', 'Please enter a phone number or extension to call.', 'warn');
      phoneInput.focus();
      return;
    }

    if (!ua || !ua.isConnected()) {
      addLog('DIAL', 'WebSocket is disconnected. Reconnecting now...', 'warn');
      initializeUA();
      return;
    }

    if (!ua.isRegistered()) {
      addLog('DIAL', 'Extension is still registering... please wait 1-2 seconds.', 'warn');
      return;
    }

    const domain = cfgDomain.value.trim();
    const targetUri = target.includes('@') ? `sip:${target}` : `sip:${target}@${domain}`;

    addLog('CALL', `Preparing audio for call to ${targetUri}...`, 'info');
    const stream = await getAudioStream();

    const options = {
      mediaConstraints: { audio: true, video: false },
      pcConfig: {
        iceServers: [
          { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
        ]
      }
    };
    if (stream) {
      options.mediaStream = stream;
    }

    try {
      addLog('CALL', `Initiating call to ${targetUri}...`, 'info');
      ua.call(targetUri, options);
    } catch (err) {
      addLog('ERROR', `Call initiation failed: ${err.message}`, 'error');
    }
  });

  // --- Hangup Button ---
  btnHangup.addEventListener('click', () => {
    if (currentSession) {
      addLog('CALL', 'Terminating call...', 'info');
      currentSession.terminate();
    }
  });

  // --- In-Call Controls: Mute & Hold ---
  btnMute.addEventListener('click', () => {
    if (!currentSession) return;
    if (isMuted) {
      currentSession.unmute({ audio: true });
      isMuted = false;
      btnMute.classList.remove('active');
      addLog('MIC', 'Microphone unmuted.', 'info');
    } else {
      currentSession.mute({ audio: true });
      isMuted = true;
      btnMute.classList.add('active');
      addLog('MIC', 'Microphone muted.', 'warn');
    }
  });

  btnHold.addEventListener('click', () => {
    if (!currentSession) return;
    if (isOnHold) {
      currentSession.unhold();
      isOnHold = false;
      btnHold.classList.remove('active');
      addLog('CALL', 'Call unheld.', 'info');
    } else {
      currentSession.hold();
      isOnHold = true;
      btnHold.classList.add('active');
      addLog('CALL', 'Call placed on hold.', 'warn');
    }
  });

  // --- Dialpad Key Handling ---
  dialpadButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-key');
      playDtmfTone(key);
      phoneInput.value += key;

      // If in active call, send DTMF
      if (currentSession && currentSession.isEstablished()) {
        try {
          currentSession.sendDTMF(key);
          addLog('DTMF', `Sent DTMF tone: ${key}`, 'info');
        } catch (e) {
          console.warn('Failed to send DTMF:', e);
        }
      }
    });
  });

  btnClearInput.addEventListener('click', () => {
    phoneInput.value = phoneInput.value.slice(0, -1);
  });

  // --- Toggle Connect / Register Button ---
  btnToggleConnect.addEventListener('click', () => {
    if (ua && ua.isRegistered()) {
      addLog('SIP', 'Unregistering from SIP server...', 'info');
      ua.unregister({ all: true });
    } else {
      initializeUA();
    }
  });

  // --- Log Actions ---
  btnClearLogs.addEventListener('click', () => {
    logStream.innerHTML = '';
  });

  btnCopyLogs.addEventListener('click', () => {
    const text = logStream.innerText;
    navigator.clipboard.writeText(text).then(() => {
      addLog('SYSTEM', 'Logs copied to clipboard!', 'info');
    }).catch(err => {
      addLog('SYSTEM', 'Failed to copy logs: ' + err.message, 'error');
    });
  });

  // --- Settings Modal Handlers ---
  function openSettings() {
    settingsModal.classList.remove('hidden');
  }

  btnOpenSettings.addEventListener('click', openSettings);
  if (btnEditConfig) btnEditConfig.addEventListener('click', openSettings);
  if (accountInfoClickable) accountInfoClickable.addEventListener('click', openSettings);
  if (statusPill) statusPill.addEventListener('click', openSettings);

  if (btnUseHostBridge) {
    btnUseHostBridge.addEventListener('click', () => {
      cfgWss.value = getDefaultWssUrl();
      addLog('CONFIG', `Using Server Bridge: ${cfgWss.value}`, 'info');
    });
  }

  btnCloseSettings.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });

  settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings();
    settingsModal.classList.add('hidden');
    addLog('CONFIG', 'Settings saved. Reconnecting...', 'info');
    initializeUA();
  });

  // Test WebSocket Only button
  btnTestWss.addEventListener('click', () => {
    const url = cfgWss.value.trim();
    addLog('TEST', `Testing raw WebSocket handshake to: ${url}...`, 'info');

    let socket;
    try {
      socket = new WebSocket(url, 'sip');
    } catch (err) {
      addLog('TEST', `❌ Invalid WebSocket URL or blocked by browser: ${err.message}`, 'error');
      return;
    }

    const testTimer = setTimeout(() => {
      if (socket.readyState !== WebSocket.OPEN) {
        addLog('TEST', `⚠️ Connection timed out after 5s. Port may be firewalled or SSL rejected.`, 'warn');
        socket.close();
      }
    }, 5000);

    socket.onopen = () => {
      clearTimeout(testTimer);
      addLog('TEST', `✅ WebSocket handshake SUCCESSFUL to ${url}!`, 'success');
      alert(`WebSocket handshake succeeded to: ${url}`);
      socket.close();
    };

    socket.onerror = (err) => {
      clearTimeout(testTimer);
      addLog('TEST', `❌ WebSocket connection failed to ${url}. Reason: Network unreachable, port closed, or SSL certificate not accepted.`, 'error');
    };

    socket.onclose = (e) => {
      clearTimeout(testTimer);
      addLog('TEST', `WebSocket closed (code: ${e.code}).`, 'info');
    };
  });

  // --- Diagnostics Modal Handlers ---
  btnRunDiagnostics.addEventListener('click', runServerDiagnostics);
  btnRerunDiag.addEventListener('click', runServerDiagnostics);

  btnCloseDiag.addEventListener('click', () => {
    diagModal.classList.add('hidden');
  });

  function runServerDiagnostics() {
    diagModal.classList.remove('hidden');
    diagLoading.classList.remove('hidden');
    diagResults.classList.add('hidden');
    diagTableBody.innerHTML = '';
    diagRecommendation.innerHTML = '';

    const host = cfgDomain.value.trim() || '103.9.14.223';
    diagHostLabel.textContent = host;

    fetch(`/api/diagnose?host=${encodeURIComponent(host)}`)
      .then(res => res.json())
      .then(data => {
        diagLoading.classList.add('hidden');
        diagResults.classList.remove('hidden');

        // Render port table
        const serviceNames = {
          5060: 'SIP Signaling (UDP/TCP)',
          80: 'HTTP Web Server',
          443: 'HTTPS Web Server / WSS Proxy',
          8088: 'Asterisk WebRTC (WS)',
          8089: 'Asterisk WebRTC (WSS)',
          7443: 'Alternative WSS Port',
          8443: 'Alternative WSS Port'
        };

        let rowsHtml = '';
        data.tcpPorts.forEach(item => {
          const badgeClass = item.status === 'open' ? 'open' : (item.status === 'timeout' ? 'timeout' : 'closed');
          rowsHtml += `
            <tr>
              <td><strong>${item.port}</strong></td>
              <td>${serviceNames[item.port] || 'Custom VoIP Port'}</td>
              <td><span class="diag-badge ${badgeClass}">${item.status}</span></td>
            </tr>
          `;
        });

        // Add UDP 5060 row
        if (data.udpSip5060) {
          const udpClass = data.udpSip5060.reachable ? 'open' : 'timeout';
          rowsHtml += `
            <tr>
              <td><strong>5060 (UDP)</strong></td>
              <td>SIP Options Ping</td>
              <td><span class="diag-badge ${udpClass}">${data.udpSip5060.reachable ? 'active' : 'no response'}</span></td>
            </tr>
          `;
        }

        diagTableBody.innerHTML = rowsHtml;
        diagRecommendation.innerHTML = `<strong>Diagnostic Result:</strong> ${data.recommendation}`;
        addLog('DIAG', `Diagnostic scan completed for ${host}`, 'info');
      })
      .catch(err => {
        diagLoading.classList.add('hidden');
        diagResults.classList.remove('hidden');
        diagRecommendation.innerHTML = `<span style="color:#f87171">Diagnostic error: ${err.message}. If running purely as static HTML, local API is unavailable.</span>`;
        addLog('DIAG', `Diagnostic API error: ${err.message}`, 'error');
      });
  }

  // --- Initial Boot ---
  loadSettings();
  addLog('SYSTEM', 'Tata SIP WebRTC Dialer initialized.', 'info');
  addLog('SYSTEM', 'Default Tata Extension: 406 | Server: 103.9.14.223', 'info');

  // Automatically start connection
  setTimeout(() => {
    initializeUA();
  }, 500);

})();
