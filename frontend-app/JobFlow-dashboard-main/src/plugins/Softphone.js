// ============================================================================
// src/plugins/Softphone.js
// JavaScript bridge for the native Android SIP softphone plugin.
// Only functional inside the native Capacitor app — not in browser.
// ============================================================================

import { registerPlugin } from '@capacitor/core';

/**
 * Softphone — wraps the native SoftphonePlugin (Android/iOS).
 *
 * Methods:
 *   initialize({ sipDomain, sipUser, sipPassword, incomingEnabled })
 *   makeCall({ phoneNumber })
 *   answerCall()
 *   declineCall()
 *   hangup()
 *   setMuted({ muted: boolean })
 *   setSpeaker({ speaker: boolean })
 *   getStatus() → { callState, initialized, muted }
 *   destroy()
 *
 * Events (via addListener):
 *   'callState'         → { state, callerNumber, message }
 *   'registrationState' → { state, message }
 *   'error'             → { message }
 *
 * Call states: 'idle', 'outgoingprogress', 'connected', 'streamsrunning',
 *              'incomingreceived', 'end', 'error', 'released'
 * Registration states: 'none', 'progress', 'ok', 'cleared', 'failed'
 */
const Softphone = registerPlugin('Softphone', {
  // Web fallback — no-ops so the app doesn't crash in browser
  web: () => ({
    initialize: async () => { console.warn('[Softphone] Native only'); },
    makeCall: async () => { console.warn('[Softphone] Native only'); },
    answerCall: async () => {},
    declineCall: async () => {},
    hangup: async () => {},
    setMuted: async () => {},
    setSpeaker: async () => {},
    getStatus: async () => ({ callState: 'idle', initialized: false, muted: false }),
    destroy: async () => {},
    addListener: () => ({ remove: () => {} }),
    removeAllListeners: async () => {},
  }),
});

export { Softphone };
