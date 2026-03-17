// ============================================================================
// src/pages/MessagesPage.jsx
// Phase 1 — Conversations list screen
// ============================================================================

import React, { useEffect, useState } from "react";
import { apiRequest } from "../api";
import { useCompany } from "../CompanyContext";
import ConversationThread from "../messages/ConversationThread.jsx";
import { formatPhoneNumber, getInitials } from "../utils/formatting.js";

function formatTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  } else {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
}

function ChannelBadge({ type }) {
  const t = (type || "").toUpperCase();

  const configs = {
    TYPE_SMS:       { bg: "bg-blue-500",    content: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 16a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v11z" />
      </svg>
    )},
    SMS:            { bg: "bg-blue-500",    content: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 16a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v11z" />
      </svg>
    )},
    TYPE_PHONE:     { bg: "bg-green-500",   content: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    )},
    TYPE_CALL:      { bg: "bg-green-500",   content: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    )},
    TYPE_EMAIL:     { bg: "bg-gray-500",    content: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    )},
    EMAIL:          { bg: "bg-gray-500",    content: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    )},
    TYPE_FB:        { bg: "bg-[#1877F2]",   content: <span className="text-white font-black" style={{fontSize:"9px"}}>f</span> },
    FB:             { bg: "bg-[#1877F2]",   content: <span className="text-white font-black" style={{fontSize:"9px"}}>f</span> },
    TYPE_IG:        { bg: "bg-pink-500",    content: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="12" r="4" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
      </svg>
    )},
    IG:             { bg: "bg-pink-500",    content: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="12" r="4" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
      </svg>
    )},
    TYPE_LIVE_CHAT: { bg: "bg-teal-500",    content: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    )},
    TYPE_WEB_CHAT:  { bg: "bg-teal-500",    content: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    )},
    TYPE_WEBCHAT:     { bg: "bg-purple-500",  content: <span className="text-white font-black" style={{fontSize:"8px"}}>C</span> },
    TYPE_CHAT_WIDGET: { bg: "bg-purple-500",  content: <span className="text-white font-black" style={{fontSize:"8px"}}>C</span> },
    CHAT_WIDGET:      { bg: "bg-purple-500",  content: <span className="text-white font-black" style={{fontSize:"8px"}}>C</span> },
    TYPE_WHATSAPP:    { bg: "bg-green-600",   content: <span className="text-white font-black" style={{fontSize:"8px"}}>W</span> },
    TYPE_GMB:         { bg: "bg-red-500",     content: <span className="text-white font-black" style={{fontSize:"8px"}}>G</span> },
  };

  const cfg = configs[t];
  if (!cfg) return null;

  return (
    <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full ${cfg.bg} flex items-center justify-center ring-2 ring-white`}>
      {cfg.content}
    </div>
  );
}

function MessageTypeLabel({ type }) {
  const labels = {
    CALL: "Call",
    EMAIL: "Email",
    SMS: "SMS",
    FB: "Facebook",
    IG: "Instagram",
    TYPE_WEBCHAT: "Chat Widget",
    TYPE_CHAT_WIDGET: "Chat Widget",
    CHAT_WIDGET: "Chat Widget",
  };
  const t = (type || "").toUpperCase();
  if (!labels[t]) return null;
  return (
    <span className="text-xs text-gray-400 mr-1">[{labels[t]}]</span>
  );
}

export default function MessagesPage({ onUnreadCount, onSelectConversation }) {
  const { currentCompany } = useCompany();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);

  useEffect(() => {
    if (!currentCompany?.id) return;
    loadConversations();
  }, [currentCompany?.id]);

  async function loadConversations() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest(
        `/api/messages/conversations?company_id=${currentCompany.id}`
      );
      const list = res?.conversations || [];
      setConversations(list);

      // Bubble total unread count up to nav badge
      if (onUnreadCount) {
        const total = list.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
        onUnreadCount(total);
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
      setError("Could not load messages. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-[#225ce5] text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-5 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Messages</h1>
            <p className="text-blue-100">{currentCompany?.name || ""}</p>
          </div>
          <button
            onClick={loadConversations}
            className="p-2 rounded-full bg-blue-700 hover:bg-blue-800 transition"
            title="Refresh"
          >
            {/* Refresh icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582M20 20v-5h-.581M5.635 19A9 9 0 104.582 9H4"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6 space-y-5">
        {loading ? (
          <div className="py-16 text-center text-gray-500">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-3" />
            <p>Loading messages...</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={loadConversations}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold"
            >
              Retry
            </button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 mx-auto mb-3 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 10h.01M12 10h.01M16 10h.01M21 16a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v11z"
              />
            </svg>
            <p className="font-medium">No conversations yet</p>
            <p className="text-sm mt-1">Messages will appear here when contacts reach out.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow divide-y divide-gray-100 overflow-hidden">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConversation(conv)}
                className="w-full text-left px-4 py-4 hover:bg-gray-50 active:bg-gray-100 transition flex items-center gap-3"
              >
                {/* Avatar */}
                <div className="flex-shrink-0 w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm uppercase">
                  {getInitials(conv.contactName)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-gray-900 truncate">
                      {conv.contactName}
                    </span>
                    <span className="flex-shrink-0 text-xs text-gray-400">
                      {formatTime(conv.lastMessageDate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-sm text-gray-500 truncate">
                      <MessageTypeLabel type={conv.lastMessageType} />
                      {conv.lastMessageBody || (
                        <span className="italic">No message preview</span>
                      )}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                      </span>
                    )}
                  </div>
                  {conv.phone && (
                    <p className="text-xs text-gray-400 mt-0.5">{formatPhoneNumber(conv.phone)}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {activeConversation && (
        <ConversationThread
          conversation={activeConversation}
          onBack={() => { setActiveConversation(null); loadConversations(); }}
          onGoToLead={(lead) => {
            window.__pendingLeadId = lead.id;
            window.__setAppScreen("leads");
            setActiveConversation(null);
          }}
          onRead={(conversationId) => {
            setConversations((prev) => {
              const updated = prev.map((c) =>
                c.id === conversationId ? { ...c, unreadCount: 0 } : c
              );
              if (onUnreadCount) {
                const total = updated.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
                onUnreadCount(total);
              }
              return updated;
            });
          }}
        />
      )}
    </div>
  );
}
