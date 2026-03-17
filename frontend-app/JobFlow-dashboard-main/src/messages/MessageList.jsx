// ============================================================================
// src/messages/MessageList.jsx
// Phase 2 — Shared message bubble renderer
// Used by ConversationModal (lead screen) and ConversationThread (messages screen)
// ============================================================================

import { useEffect, useRef, useState } from "react";
import { formatPhoneNumber, getInitials } from "../utils/formatting.js";
import { apiRequest } from "../api";

const CHANNEL_LABELS = {
  TYPE_SMS:       { label: "SMS",       color: "bg-blue-100 text-blue-700" },
  SMS:            { label: "SMS",       color: "bg-blue-100 text-blue-700" },
  TYPE_EMAIL:     { label: "Email",     color: "bg-gray-100 text-gray-600" },
  EMAIL:          { label: "Email",     color: "bg-gray-100 text-gray-600" },
  TYPE_PHONE:     { label: "Call",      color: "bg-green-100 text-green-700" },
  TYPE_CALL:      { label: "Call",      color: "bg-green-100 text-green-700" },
  CALL:           { label: "Call",      color: "bg-green-100 text-green-700" },
  TYPE_FB:        { label: "Facebook",  color: "bg-blue-100 text-blue-800" },
  FB:             { label: "Facebook",  color: "bg-blue-100 text-blue-800" },
  TYPE_FACEBOOK:  { label: "Facebook",  color: "bg-blue-100 text-blue-800" },
  FACEBOOK:       { label: "Facebook",  color: "bg-blue-100 text-blue-800" },
  TYPE_IG:        { label: "Instagram", color: "bg-pink-100 text-pink-700" },
  IG:             { label: "Instagram", color: "bg-pink-100 text-pink-700" },
  TYPE_LIVE_CHAT:    { label: "Web Chat",    color: "bg-teal-100 text-teal-700" },
  TYPE_WEB_CHAT:     { label: "Web Chat",    color: "bg-teal-100 text-teal-700" },
  TYPE_WEBCHAT:      { label: "Chat Widget", color: "bg-purple-100 text-purple-700" },
  TYPE_CHAT_WIDGET:  { label: "Chat Widget", color: "bg-purple-100 text-purple-700" },
  CHAT_WIDGET:       { label: "Chat Widget", color: "bg-purple-100 text-purple-700" },
  TYPE_WHATSAPP:     { label: "WhatsApp",    color: "bg-green-100 text-green-800" },
  TYPE_GMB:          { label: "Google",      color: "bg-red-100 text-red-700" },
};

function ChannelPill({ messageType }) {
  const cfg = CHANNEL_LABELS[(messageType || "").toUpperCase()];
  if (!cfg) return null;
  return (
    <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function resolveDirection(msg) {
  const isEmail = msg.messageType === "TYPE_EMAIL";
  const isSMS = msg.messageType === "TYPE_SMS";

  // Email: prefer meta direction field
  if (isEmail && msg.meta?.email?.direction) return msg.meta.email.direction;
  // Use explicit direction from GHL if present (covers calls, SMS, etc.)
  if (msg.direction) return msg.direction;
  // SMS with no direction field = sent by the user (outbound)
  if (isSMS) return "outbound";
  // Everything else (calls with no direction) = inbound
  return "inbound";
}

function resolveDisplayText(msg) {
  const isCall = msg.messageType === "TYPE_CALL";
  const isEmail = msg.messageType === "TYPE_EMAIL";

  if (isCall) {
    return `Incoming Call from: ${formatPhoneNumber(msg.from || "")}`;
  }
  if (isEmail && msg.meta?.email?.subject) {
    return msg.meta.email.subject;
  }
  return msg.body || "";
}

function CallCard({ msg, idx, companyId }) {
  const callStatus = msg.status || msg.meta?.call?.status;
  const callDuration = msg.meta?.call?.duration || 0;
  const isInbound = resolveDirection(msg) !== "outbound";
  const isCompleted = callStatus === "completed";

  const [recordingUrl, setRecordingUrl] = useState(null);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);

  const [transcript, setTranscript] = useState(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const statusLabel = {
    completed: "Completed",
    "no-answer": "No Answer",
    missed: "Missed",
    busy: "Busy",
    failed: "Failed",
    cancelled: "Cancelled",
  }[callStatus] || callStatus || "";

  const statusColor = isCompleted ? "text-green-600" : "text-red-500";

  const formatDuration = (secs) => {
    if (!secs) return null;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  async function handlePlayRecording() {
    if (showPlayer) { setShowPlayer(false); return; }
    if (recordingUrl) { setShowPlayer(true); return; }
    setRecordingLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const base = import.meta.env.VITE_API_URL;
      const response = await fetch(`${base}/api/messages/${msg.id}/recording?company_id=${companyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("No recording");
      const blob = await response.blob();
      setRecordingUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error("Recording fetch failed:", err);
      setRecordingUrl(null);
    } finally {
      setShowPlayer(true);
      setRecordingLoading(false);
    }
  }

  async function handleViewTranscript() {
    if (showTranscript) { setShowTranscript(false); return; }
    if (transcript !== null) { setShowTranscript(true); return; }
    setTranscriptLoading(true);
    try {
      const res = await apiRequest(`/api/messages/${msg.id}/transcription?company_id=${companyId}`);
      setTranscript(res?.text || "No transcript available.");
      setShowTranscript(true);
    } catch { setTranscript("Could not load transcript."); setShowTranscript(true); }
    finally { setTranscriptLoading(false); }
  }

  return (
    <div key={idx} className={`flex ${isInbound ? "justify-start" : "justify-end"}`}>
      <div className="max-w-[75%]">
        <div className="p-3 rounded-xl bg-gray-100 text-gray-800 border border-gray-200">
          <div className="flex items-center gap-2 mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span className="text-sm font-semibold text-gray-700">
              {isInbound ? "Inbound Call" : "Outbound Call"}
            </span>
            {statusLabel && (
              <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
            )}
          </div>
          <p className="text-sm text-gray-600">{formatPhoneNumber(msg.from || "")}</p>
          {formatDuration(callDuration) && (
            <p className="text-xs text-gray-500 mt-0.5">Duration: {formatDuration(callDuration)}</p>
          )}
          {isCompleted && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={handlePlayRecording}
                disabled={recordingLoading}
                className="text-xs px-2 py-1 bg-white border border-gray-300 rounded-lg text-gray-600 font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {recordingLoading ? "Loading..." : showPlayer ? "Hide Recording" : "Play Recording"}
              </button>
              <button
                onClick={handleViewTranscript}
                disabled={transcriptLoading}
                className="text-xs px-2 py-1 bg-white border border-gray-300 rounded-lg text-gray-600 font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {transcriptLoading ? "Loading..." : showTranscript ? "Hide Transcript" : "View Transcript"}
              </button>
            </div>
          )}
          {showPlayer && (
            <div className="mt-2">
              {recordingUrl
                ? <audio controls src={recordingUrl} className="w-full mt-1" />
                : <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">No recording available for this call.</p>
              }
            </div>
          )}
          {showTranscript && (
            <div className="mt-2 max-h-40 overflow-y-auto bg-white border border-gray-200 rounded-lg p-2">
              <p className="text-xs text-gray-700 whitespace-pre-wrap">{transcript}</p>
            </div>
          )}
        </div>
        <div className="text-xs text-gray-400 mt-1 px-1 flex items-center">
          {new Date(msg.dateAdded).toLocaleString()}
          <ChannelPill messageType={msg.messageType} />
        </div>
      </div>
    </div>
  );
}

const FAILED_STATUSES = new Set(["failed", "undelivered", "error"]);


function MessageBubble({ msg, idx, contactName, companyId }) {
  const isEmail = msg.messageType === "TYPE_EMAIL";
  const isSMS = msg.messageType === "TYPE_SMS";
  const isCall = msg.messageType === "TYPE_CALL";
  const isWorkflow = msg.source === "workflow";

  const direction = resolveDirection(msg);
  const displayText = resolveDisplayText(msg);
  const isOutbound = direction === "outbound";
  const isFailed = isOutbound && FAILED_STATUSES.has((msg.status || "").toLowerCase());

  // Call card
  if (isCall) {
    return <CallCard key={idx} msg={msg} idx={idx} companyId={companyId} />;
  }

  // Standard SMS / Email / Workflow bubble
  const bubbleColor = isOutbound
    ? isEmail
      ? "bg-green-100 text-gray-800"
      : "bg-blue-100 text-gray-800"
    : "bg-gray-100 text-gray-800";

  const avatarColor = isOutbound ? "bg-blue-500" : "bg-gray-300 text-gray-700";

  const avatarContent = isOutbound
    ? (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )
    : <span className="text-xs font-bold">{getInitials(contactName)}</span>;

  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
      <div className="flex items-start gap-2 max-w-[75%]">
        {!isOutbound && (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor}`}>
            {avatarContent}
          </div>
        )}
        <div>
          <div className={`p-3 rounded-xl ${isFailed ? "bg-red-50 border border-red-200" : bubbleColor}`}>
            <p className="text-sm">{displayText}</p>
          </div>
          <div className="text-xs text-gray-400 mt-1 px-1 flex items-center flex-wrap gap-x-1">
            {new Date(msg.dateAdded).toLocaleString()}
            <ChannelPill messageType={msg.messageType} />
            {isWorkflow && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700">workflow</span>}
            {isFailed && <span className="text-red-500 font-semibold">Failed</span>}
          </div>
        </div>
        {isOutbound && (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor}`}>
            {avatarContent}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MessageList({
  messages = [],
  hasMore = false,
  onLoadMore,
  loadingMore = false,
  autoScroll = true,
  contactName = "",
  companyId = null,
}) {
  const endRef = useRef(null);

  useEffect(() => {
    if (autoScroll) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll]);

  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No messages found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {hasMore && (
        <button
          onClick={onLoadMore}
          disabled={loadingMore}
          className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 font-semibold disabled:opacity-50"
        >
          {loadingMore ? "Loading..." : "Load older messages"}
        </button>
      )}

      {messages.map((msg, idx) => (
        <MessageBubble key={msg.id || idx} msg={msg} idx={idx} contactName={contactName} companyId={companyId} />
      ))}

      <div ref={endRef} />
    </div>
  );
}
