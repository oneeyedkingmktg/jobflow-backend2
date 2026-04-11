// ============================================================================
// src/components/SoftphoneWidget.jsx
// Active call overlay — shown during outgoing, incoming, and connected calls.
// Supports minimize to a floating pill so the user can browse the app mid-call.
// ============================================================================

import React, { useState, useEffect } from 'react';
import { formatPhoneNumber } from '../utils/formatting';

const DTMF_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

export default function SoftphoneWidget({
  callState,
  callerNumber,
  callerName,
  formattedTime,
  isMuted,
  isSpeaker,
  isConnected,
  isDialing,
  isIncoming,
  onHangup,
  onAnswer,
  onDecline,
  onToggleMute,
  onToggleSpeaker,
  onSendDtmf,
  pendingCall,
  onConfirmCall,
  onCancelCall,
}) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [dtmfDigits, setDtmfDigits] = useState('');

  // Auto-reset minimize/keypad when call ends
  useEffect(() => {
    if (!callState || callState === 'idle' || callState === 'released') {
      setIsMinimized(false);
      setShowKeypad(false);
      setDtmfDigits('');
    }
    // Incoming calls must always show full screen
    if (callState === 'incomingreceived') {
      setIsMinimized(false);
    }
  }, [callState]);

  const handleDtmfKey = (key) => {
    onSendDtmf?.(key);
    setDtmfDigits((prev) => prev + key);
  };

  // ── Pre-dial screen ──────────────────────────────────────────────────────
  if (pendingCall && (!callState || callState === 'idle' || callState === 'released')) {
    const displayName = pendingCall.name || formatPhoneNumber(pendingCall.phone) || pendingCall.phone;
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-gray-900 bg-opacity-95">
        <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center mb-4 shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <p className="text-white text-2xl font-bold mb-1">{displayName}</p>
        <p className="text-gray-400 text-sm mb-8">{formatPhoneNumber(pendingCall.phone)}</p>
        <div className="flex gap-16 items-center">
          <div className="flex flex-col items-center gap-2">
            <button onClick={onCancelCall} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg active:bg-red-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <span className="text-gray-400 text-xs">Cancel</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button onClick={onConfirmCall} className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg active:bg-green-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" />
              </svg>
            </button>
            <span className="text-gray-400 text-xs">Call</span>
          </div>
        </div>
      </div>
    );
  }

  if (!callState || callState === 'idle' || callState === 'released') return null;

  const displayName = callerName || formatPhoneNumber(callerNumber) || callerNumber || 'Unknown';

  const statusLabel = isIncoming
    ? 'Incoming Call'
    : isDialing
    ? 'Calling...'
    : isConnected
    ? formattedTime
    : callState;

  // ── Minimized pill ───────────────────────────────────────────────────────
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 left-4 right-4 z-[200] flex items-center justify-between bg-gray-900 rounded-2xl px-4 py-3 shadow-2xl border border-gray-700">
        {/* Left: phone icon + name + timer */}
        <button
          className="flex items-center gap-3 flex-1 min-w-0"
          onClick={() => setIsMinimized(false)}
        >
          <div className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold truncate leading-tight">{displayName}</p>
            <p className="text-green-400 text-xs leading-tight">{statusLabel}</p>
          </div>
        </button>

        {/* Right: expand + hangup */}
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          <button
            onClick={() => setIsMinimized(false)}
            className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center active:bg-gray-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
            </svg>
          </button>
          <button
            onClick={onHangup}
            className="w-9 h-9 rounded-full bg-red-500 flex items-center justify-center active:bg-red-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // ── Full-screen overlay ──────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-gray-900 bg-opacity-95">

      {/* Minimize button — only during active/dialing (not incoming) */}
      {!isIncoming && (
        <button
          onClick={() => setIsMinimized(true)}
          className="absolute top-12 right-5 w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center active:bg-gray-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {/* Contact avatar */}
      <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center mb-4 shadow-lg">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>

      {/* Name / number */}
      <p className="text-white text-2xl font-bold mb-1">{displayName}</p>
      <p className="text-gray-400 text-sm mb-8">{statusLabel}</p>

      {/* INCOMING — Accept / Decline */}
      {isIncoming && (
        <div className="flex gap-16 items-center">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onDecline}
              className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg active:bg-red-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
              </svg>
            </button>
            <span className="text-gray-400 text-xs">Decline</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onAnswer}
              className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg active:bg-green-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </button>
            <span className="text-gray-400 text-xs">Accept</span>
          </div>
        </div>
      )}

      {/* ACTIVE CALL — Mute / Hangup / Speaker / Keypad */}
      {!isIncoming && (
        <div className="w-full flex flex-col items-center">
          {/* DTMF keypad — shown above controls when toggled */}
          {showKeypad && (
            <div className="mb-6 w-64">
              {/* Digit display */}
              <div className="bg-gray-800 rounded-xl px-4 py-2 mb-4 text-center min-h-[40px] flex items-center justify-center">
                <span className="text-white text-xl font-mono tracking-widest">
                  {dtmfDigits || <span className="text-gray-600">—</span>}
                </span>
              </div>
              {/* 3×4 grid */}
              {DTMF_KEYS.map((row, ri) => (
                <div key={ri} className="flex justify-center gap-4 mb-3">
                  {row.map((key) => (
                    <button
                      key={key}
                      onClick={() => handleDtmfKey(key)}
                      className="w-16 h-14 rounded-2xl bg-gray-700 active:bg-gray-500 flex items-center justify-center text-white text-2xl font-semibold shadow"
                    >
                      {key}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Control buttons row */}
          <div className="flex gap-8 items-center">
            {/* Mute */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={onToggleMute}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow ${isMuted ? 'bg-white' : 'bg-gray-700'}`}
              >
                {isMuted ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>
              <span className="text-gray-400 text-xs">{isMuted ? 'Unmute' : 'Mute'}</span>
            </div>

            {/* Hangup */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={onHangup}
                className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg active:bg-red-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" />
                </svg>
              </button>
              <span className="text-gray-400 text-xs">End</span>
            </div>

            {/* Speaker */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={onToggleSpeaker}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow ${isSpeaker ? 'bg-white' : 'bg-gray-700'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`w-6 h-6 ${isSpeaker ? 'text-gray-900' : 'text-white'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0l-3-3m3 3l3-3M6.343 9.343a8 8 0 000 11.314" />
                </svg>
              </button>
              <span className="text-gray-400 text-xs">{isSpeaker ? 'Earpiece' : 'Speaker'}</span>
            </div>

            {/* Keypad toggle */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => setShowKeypad((v) => !v)}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow ${showKeypad ? 'bg-white' : 'bg-gray-700'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`w-6 h-6 ${showKeypad ? 'text-gray-900' : 'text-white'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m0 14v1M4 12H3m18 0h-1M7.05 7.05l-.707-.707M17.657 17.657l-.707-.707M7.05 16.95l-.707.707M17.657 6.343l-.707.707" />
                  <circle cx="12" cy="12" r="3" strokeWidth={2} />
                </svg>
              </button>
              <span className="text-gray-400 text-xs">Keypad</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
