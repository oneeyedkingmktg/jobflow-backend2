// ============================================================================
// src/messages/MessageList.jsx
// Phase 2 — Shared message bubble renderer
// Used by ConversationModal (lead screen) and ConversationThread (messages screen)
// ============================================================================

import { useEffect, useRef } from "react";
import { formatPhoneNumber, getInitials } from "../utils/formatting.js";

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
  TYPE_LIVE_CHAT: { label: "Web Chat",  color: "bg-teal-100 text-teal-700" },
  TYPE_WEB_CHAT:  { label: "Web Chat",  color: "bg-teal-100 text-teal-700" },
  TYPE_WHATSAPP:  { label: "WhatsApp",  color: "bg-green-100 text-green-800" },
  TYPE_GMB:       { label: "Google",    color: "bg-red-100 text-red-700" },
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
  const isCall = msg.messageType === "TYPE_CALL";
  const isSystemMessage = isEmail || msg.messageType === "TYPE_SMS";

  if (isEmail && msg.meta?.email?.direction) return msg.meta.email.direction;
  if (isCall) return "inbound";
  if (isSystemMessage && !msg.direction) return "outbound";
  return msg.direction || "outbound";
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

function MessageBubble({ msg, idx, contactName }) {
  const isEmail = msg.messageType === "TYPE_EMAIL";
  const isSMS = msg.messageType === "TYPE_SMS";
  const isCall = msg.messageType === "TYPE_CALL";
  const isWorkflow = msg.source === "workflow";

  const direction = resolveDirection(msg);
  const displayText = resolveDisplayText(msg);
  const isOutbound = direction === "outbound";

  // Call card
  if (isCall) {
    return (
      <div key={idx} className="flex justify-start">
        <div className="max-w-[75%]">
          <div className="p-3 rounded-xl bg-gray-100 text-gray-800 border border-gray-200">
            <div className="flex items-center gap-2 mb-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span className="text-sm font-semibold text-gray-700">Call</span>
            </div>
            <p className="text-sm">{displayText}</p>
            {/* Stubs — wired in Phase 4 */}
            <div className="flex gap-2 mt-2">
              <button className="text-xs px-2 py-1 bg-white border border-gray-300 rounded-lg text-gray-600 font-medium">
                Play Recording
              </button>
              <button className="text-xs px-2 py-1 bg-white border border-gray-300 rounded-lg text-gray-600 font-medium">
                View Transcript
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-1 px-1 flex items-center">
            {new Date(msg.dateAdded).toLocaleString()}
            <ChannelPill messageType={msg.messageType} />
          </div>
        </div>
      </div>
    );
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
          <div className={`p-3 rounded-xl ${bubbleColor}`}>
            <p className="text-sm">{displayText}</p>
          </div>
          <div className="text-xs text-gray-400 mt-1 px-1 flex items-center flex-wrap gap-x-1">
            {new Date(msg.dateAdded).toLocaleString()}
            <ChannelPill messageType={msg.messageType} />
            {isWorkflow && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700">workflow</span>}
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
        <MessageBubble key={msg.id || idx} msg={msg} idx={idx} contactName={contactName} />
      ))}

      <div ref={endRef} />
    </div>
  );
}
