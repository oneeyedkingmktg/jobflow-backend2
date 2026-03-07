// ============================================================================
// src/messages/ConversationThread.jsx
// Phase 2 — Thread overlay for the Messages screen
// ============================================================================

import { useState, useEffect } from "react";
import { apiRequest } from "../api";
import { useCompany } from "../CompanyContext";
import MessageList from "./MessageList.jsx";
import ReplyBox from "./ReplyBox.jsx";
import { formatPhoneNumber } from "../utils/formatting.js";

export default function ConversationThread({ conversation, onBack, onGoToLead, onRead }) {
  const { currentCompany } = useCompany();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [shouldScroll, setShouldScroll] = useState(true);
  const [matchedLead, setMatchedLead] = useState(undefined); // undefined = loading, null = not found

  const companyId = currentCompany?.id;

  // Fetch messages on mount + mark as read
  useEffect(() => {
    if (!conversation?.id || !companyId) return;
    fetchMessages();
    lookupLead();
    markRead();
  }, [conversation?.id, companyId]);

  async function markRead() {
    try {
      await apiRequest(`/api/messages/${conversation.id}/read?company_id=${companyId}`, {
        method: "PUT",
      });
      if (typeof onRead === "function") onRead(conversation.id);
    } catch {
      // Non-fatal — silently ignore
    }
  }

  async function fetchMessages(limit = 20) {
    setLoading(true);
    setError(null);
    setShouldScroll(true);
    try {
      const res = await apiRequest(
        `/api/messages/${conversation.id}/messages?company_id=${companyId}&limit=${limit}`
      );
      const msgs = Array.isArray(res?.messages?.messages)
        ? res.messages.messages
        : Array.isArray(res?.messages)
        ? res.messages
        : [];
      const reversed = [...msgs].reverse();
      setMessages(reversed);
      setHasMore(msgs.length >= limit);
    } catch (err) {
      console.error("Failed to fetch thread messages:", err);
      setError("Could not load messages. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    setShouldScroll(false);
    try {
      const nextLimit = messages.length + 20;
      const res = await apiRequest(
        `/api/messages/${conversation.id}/messages?company_id=${companyId}&limit=${nextLimit}`
      );
      const msgs = Array.isArray(res?.messages?.messages)
        ? res.messages.messages
        : Array.isArray(res?.messages)
        ? res.messages
        : [];
      const reversed = [...msgs].reverse();
      setMessages(reversed);
      setHasMore(msgs.length >= nextLimit);
    } catch (err) {
      console.error("Failed to load more messages:", err);
    } finally {
      setLoadingMore(false);
    }
  }

  async function lookupLead() {
    if (!conversation?.contactId || !companyId) {
      setMatchedLead(null);
      return;
    }
    try {
      const phone = conversation.phone
        ? `&phone=${encodeURIComponent(conversation.phone)}`
        : "";
      const res = await apiRequest(
        `/api/messages/lead-lookup?contactId=${conversation.contactId}&company_id=${companyId}${phone}`
      );
      setMatchedLead(res?.lead || null);
    } catch {
      setMatchedLead(null);
    }
  }

  return (
    <div className="fixed inset-0 bg-white z-[100] flex flex-col">
      {/* Header */}
      <div className="bg-[#225ce5] text-white shadow-md flex-shrink-0">
        <div className="px-4 py-4 flex items-center gap-3">
          {/* Back */}
          <button
            onClick={onBack}
            className="p-2 rounded-full bg-blue-700 hover:bg-blue-800 transition flex-shrink-0"
            aria-label="Back to messages"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Contact info — center */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white truncate leading-tight">
              {conversation.contactName}
            </p>
            {conversation.phone && (
              <p className="text-blue-100 text-xs truncate">{formatPhoneNumber(conversation.phone)}</p>
            )}
          </div>

          {/* Go to Lead button — only shown when lead found */}
          {matchedLead && (
            <button
              onClick={() => onGoToLead && onGoToLead(matchedLead)}
              className="flex-shrink-0 px-3 py-1.5 bg-white text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-50 transition"
            >
              Go to Lead →
            </button>
          )}
        </div>
      </div>

      {/* Message area */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="py-16 text-center text-gray-500">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-3" />
            <p>Loading messages...</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={() => fetchMessages()}
              className="px-4 py-3 bg-gray-800 text-white rounded-lg font-semibold"
            >
              Retry
            </button>
          </div>
        ) : (
          <MessageList
            messages={messages}
            hasMore={hasMore}
            onLoadMore={loadMore}
            loadingMore={loadingMore}
            autoScroll={shouldScroll}
            contactName={conversation.contactName}
            companyId={companyId}
          />
        )}
      </div>

      <div className="flex-shrink-0">
        <ReplyBox
          conversationId={conversation.id}
          contactId={conversation.contactId}
          channelType={conversation.channelType}
          onSent={() => fetchMessages()}
        />
      </div>
    </div>
  );
}
