// ============================================================================
// src/hooks/useSoftphone.js
// Manages SIP softphone state — wraps the native Softphone Capacitor plugin.
// Only active inside the native app (no-ops in browser).
// ============================================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { Softphone } from '../plugins/Softphone';
import { apiRequest } from '../api';
import { isNativeApp } from '../utils/platform';

const IDLE_STATES = ['idle', 'released', 'end', 'error', ''];

export function useSoftphone() {
  const [initialized, setInitialized] = useState(false);
  const [registrationState, setRegistrationState] = useState('none'); // none | progress | ok | failed
  const [callState, setCallState] = useState('idle');
  const [callerNumber, setCallerNumber] = useState('');
  const [callerName, setCallerName] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState(null);

  const timerRef = useRef(null);
  const listenersRef = useRef([]);

  const isActive = !IDLE_STATES.includes(callState);
  const isIncoming = callState === 'incomingreceived';
  const isConnected = callState === 'streamsrunning' || callState === 'connected';
  const isDialing = callState === 'outgoingprogress' || callState === 'outgoingearlymedia';

  // =========================================================================
  // INITIALIZE — fetch creds from backend, register with SIP server
  // =========================================================================
  const initialize = useCallback(async () => {
    if (!isNativeApp()) return;
    try {
      const res = await apiRequest('/api/sip/credentials');
      if (!res?.sip_domain) return; // SIP not configured for this user

      await Softphone.initialize({
        sipDomain: res.sip_domain,
        sipUser: res.sip_username,
        sipPassword: res.sip_password,
        incomingEnabled: res.sip_incoming_enabled,
      });
      setInitialized(true);
      setError(null);
    } catch (err) {
      // SIP not configured — not an error worth showing
      console.log('[useSoftphone] SIP not configured or init failed:', err.message);
    }
  }, []);

  // =========================================================================
  // CALL TIMER
  // =========================================================================
  const startTimer = useCallback(() => {
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setElapsedSeconds(0);
  }, []);

  // =========================================================================
  // ATTACH NATIVE EVENT LISTENERS
  // =========================================================================
  useEffect(() => {
    if (!isNativeApp()) return;

    const regListener = Softphone.addListener('registrationState', (data) => {
      console.log('[Softphone] Registration:', data.state, data.message);
      setRegistrationState(data.state);
    });

    const callListener = Softphone.addListener('callState', (data) => {
      console.log('[Softphone] Call state:', data.state, data.callerNumber);
      setCallState(data.state);
      setCallerNumber(data.callerNumber || '');

      if (data.state === 'streamsrunning' || data.state === 'connected') {
        startTimer();
        setIsMuted(false);
      }
      if (IDLE_STATES.includes(data.state)) {
        stopTimer();
        setIsMuted(false);
        setIsSpeaker(false);
        setCallerName('');
      }
    });

    const errListener = Softphone.addListener('error', (data) => {
      console.error('[Softphone] Error:', data.message);
      setError(data.message);
    });

    listenersRef.current = [regListener, callListener, errListener];

    // Initialize on mount
    initialize();

    return () => {
      listenersRef.current.forEach((l) => l?.remove?.());
      stopTimer();
    };
  }, [initialize, startTimer, stopTimer]);

  // =========================================================================
  // ACTIONS
  // =========================================================================
  const makeCall = useCallback(async (phoneNumber, displayName = '') => {
    if (!isNativeApp()) return;
    setCallerName(displayName);
    setCallerNumber(phoneNumber);
    await Softphone.makeCall({ phoneNumber });
  }, []);

  const hangup = useCallback(async () => {
    await Softphone.hangup();
  }, []);

  const answerCall = useCallback(async () => {
    await Softphone.answerCall();
  }, []);

  const declineCall = useCallback(async () => {
    await Softphone.declineCall();
  }, []);

  const toggleMute = useCallback(async () => {
    const next = !isMuted;
    await Softphone.setMuted({ muted: next });
    setIsMuted(next);
  }, [isMuted]);

  const toggleSpeaker = useCallback(async () => {
    const next = !isSpeaker;
    await Softphone.setSpeaker({ speaker: next });
    setIsSpeaker(next);
  }, [isSpeaker]);

  // =========================================================================
  // FORMAT TIMER
  // =========================================================================
  const formattedTime = (() => {
    const m = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
    const s = (elapsedSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  })();

  return {
    // State
    initialized,
    registrationState,
    callState,
    callerNumber,
    callerName,
    isMuted,
    isSpeaker,
    formattedTime,
    error,
    // Derived
    isActive,
    isIncoming,
    isConnected,
    isDialing,
    // Actions
    makeCall,
    hangup,
    answerCall,
    declineCall,
    toggleMute,
    toggleSpeaker,
    reinitialize: initialize,
  };
}
