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
import { useSoftphone } from "../hooks/useSoftphone.js";
import SoftphoneWidget from "../components/SoftphoneWidget.jsx";
import { isNativeApp } from "../utils/platform.js";

export default function ConversationThread({ conversation, onBack, onGoToLead, onRead }) {
  const { currentCompany } = useCompany();
  const [messages, setMessages] = useState([]);
  const [availableTypes, setAvailableTypes] = useState(["SMS"]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [shouldScroll, setShouldScroll] = useState(true);
  const [matchedLead, setMatchedLead] = useState(undefined); // undefined = loading, null = not found

  const companyId = currentCompany?.id;

  const softphone = useSoftphone();
  const [pendingCall, setPendingCall] = useState(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(offset);
    };
    vv.addEventListener('resize', handler);
    vv.addEventListener('scroll', handler);
    return () => {
      vv.removeEventListener('resize', handler);
      vv.removeEventListener('scroll', handler);
    };
  }, []);

  // Fetch messages on mount + mark as read
  useEffect(() => {
    if (!conversation?.id || !companyId) return;
    fetchMessages();
    lookupLead();
    markRead();
  }, [conversation?.id, companyId]);

  // Poll for new messages — lightweight timestamp check every 15s, no spinner
  useEffect(() => {
    if (!conversation?.id || !companyId) return;
    const lastKnownAt = { current: null };
    let initialized = false;

    const poll = async () => {
      try {
        const res = await apiRequest(
          `/api/messages/check-update?conversationId=${conversation.id}&company_id=${companyId}`
        );
        if (!initialized) {
          lastKnownAt.current = res.lastMessageAt;
          initialized = true;
          return;
        }
        if (res.lastMessageAt && res.lastMessageAt !== lastKnownAt.current) {
          lastKnownAt.current = res.lastMessageAt;
          // Silent refresh — no spinner, preserves scroll position
          try {
            const msgRes = await apiRequest(
              `/api/messages/${conversation.id}/messages?company_id=${companyId}&limit=20`
            );
            const msgs = Array.isArray(msgRes?.messages?.messages)
              ? msgRes.messages.messages
              : Array.isArray(msgRes?.messages)
              ? msgRes.messages
              : [];
            setMessages([...msgs].reverse());
            setHasMore(msgs.length >= 20);
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    };

    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
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

      const FB_TYPES = new Set(['FB','TYPE_FB','FACEBOOK','TYPE_FACEBOOK']);
      const IG_TYPES = new Set(['IG','TYPE_IG']);
      const WEBCHAT_TYPES = new Set(['WEBCHAT','TYPE_WEBCHAT','LIVE_CHAT','TYPE_LIVE_CHAT','TYPE_WEB_CHAT','TYPE_CHAT_WIDGET','CHAT_WIDGET']);
      const msgType = (m) => String(m.messageType || m.type || '').toUpperCase();
      const hasFB = msgs.some(m => FB_TYPES.has(msgType(m)));
      const hasIG = msgs.some(m => IG_TYPES.has(msgType(m)));
      const hasWebchat = msgs.some(m => WEBCHAT_TYPES.has(msgType(m)));
      setAvailableTypes(['SMS', ...(hasFB ? ['FB'] : []), ...(hasIG ? ['IG'] : []), ...(hasWebchat ? ['WEBCHAT'] : [])]);
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
    <div className="fixed inset-0 bg-white z-[100] flex flex-col" style={{ bottom: keyboardOffset }}>
      {/* Softphone overlay — shown during active/incoming calls */}
      <SoftphoneWidget
        callState={softphone.callState}
        callerNumber={softphone.callerNumber}
        callerName={softphone.callerName}
        formattedTime={softphone.formattedTime}
        isMuted={softphone.isMuted}
        isSpeaker={softphone.isSpeaker}
        isConnected={softphone.isConnected}
        isDialing={softphone.isDialing}
        isIncoming={softphone.isIncoming}
        onHangup={softphone.hangup}
        onAnswer={softphone.answerCall}
        onDecline={softphone.declineCall}
        onToggleMute={softphone.toggleMute}
        onToggleSpeaker={softphone.toggleSpeaker}
        onSendDtmf={softphone.sendDtmf}
        pendingCall={pendingCall}
        onConfirmCall={() => {
          setPendingCall(null);
          softphone.makeCall(pendingCall.phone, pendingCall.name).catch((err) => {
            console.error('[makeCall failed]', err);
            alert('Call failed: ' + (err?.message || 'Unknown error'));
          });
        }}
        onCancelCall={() => setPendingCall(null)}
      />
      {/* Header */}
      <div className="bg-[#225ce5] text-white shadow-md flex-shrink-0">
        <div className="px-4 pt-16 pb-4 flex items-center gap-3">
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

          {/* Call button — native app only, requires phone number */}
          {isNativeApp() && conversation.phone && (
            <button
              onClick={() => setPendingCall({ phone: conversation.phone, name: conversation.contactName })}
              disabled={softphone.isActive}
              className="flex-shrink-0 w-9 h-9 rounded-full bg-green-500 hover:bg-green-600 disabled:opacity-40 flex items-center justify-center transition"
              title={`Call ${formatPhoneNumber(conversation.phone)}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" clipRule="evenodd" />
              </svg>
            </button>
          )}

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
          availableTypes={availableTypes}
          onSent={() => fetchMessages()}
        />
      </div>
    </div>
  );
}
