// ============================================================================
// src/leadModalParts/ConversationModal.jsx
// Full-screen conversation overlay opened from the lead/contact record.
// Same features as ConversationThread — reply box, call button, softphone.
// No "Go to Lead" button (already on the lead page).
// ============================================================================

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import MessageList from "../messages/MessageList.jsx";
import ReplyBox from "../messages/ReplyBox.jsx";
import { useCompany } from "../CompanyContext";
import { useSoftphone } from "../hooks/useSoftphone.js";
import SoftphoneWidget from "../components/SoftphoneWidget.jsx";
import { isNativeApp } from "../utils/platform.js";
import { formatPhoneNumber } from "../utils/formatting.js";

export default function ConversationModal({ lead, onClose }) {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [shouldScroll, setShouldScroll] = useState(true);
  const [conversationId, setConversationId] = useState(null);
  const [contactId, setContactId] = useState(lead.ghl_contact_id || null);
  const [availableTypes, setAvailableTypes] = useState(["SMS"]);

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

  const phone = lead.phone || lead.phone_number || lead.phoneNumber || "";
  const name = lead.name || lead.fullName || lead.full_name || "";

  useEffect(() => {
    fetchConversations();
  }, [lead.id]);

  // Poll for new messages — lightweight timestamp check, no spinner
  useEffect(() => {
    if (!conversationId || !companyId) return;
    const lastKnownAt = { current: undefined };

    const poll = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const base = import.meta.env.VITE_API_URL;
        const res = await fetch(
          `${base}/api/messages/check-update?conversationId=${conversationId}&company_id=${companyId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (lastKnownAt.current === undefined) {
          // First call: capture baseline, don't refresh
          lastKnownAt.current = data.lastMessageAt;
          return;
        }
        if (data.lastMessageAt && data.lastMessageAt !== lastKnownAt.current) {
          lastKnownAt.current = data.lastMessageAt;
          try {
            const msgRes = await fetch(
              `${base}/leads/${lead.id}/conversations?limit=20`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            const msgData = await msgRes.json();
            const msgs = Array.isArray(msgData.messages?.messages)
              ? msgData.messages.messages
              : Array.isArray(msgData.messages)
              ? msgData.messages
              : [];
            setMessages([...msgs].reverse());
            setHasMore(msgs.length >= 20);
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    };

    // Run immediately to capture baseline, then every 15s
    poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, [conversationId, companyId]);

  async function fetchConversations(limit = 20) {
    try {
      setLoading(true);
      setError("");
      setShouldScroll(true);
      const token = localStorage.getItem("authToken");
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/leads/${lead.id}/conversations?limit=${limit}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error("Failed to fetch conversations");
      const data = await response.json();

      const msgs = Array.isArray(data.messages?.messages)
        ? data.messages.messages
        : Array.isArray(data.messages)
        ? data.messages
        : [];

      setMessages([...msgs].reverse());
      setHasMore(msgs.length >= limit);
      if (data.conversationId) setConversationId(data.conversationId);
      if (data.contactId) setContactId(data.contactId);

      const FB_TYPES = new Set(['FB','TYPE_FB','FACEBOOK','TYPE_FACEBOOK']);
      const IG_TYPES = new Set(['IG','TYPE_IG']);
      const WEBCHAT_TYPES = new Set(['WEBCHAT','TYPE_WEBCHAT','LIVE_CHAT','TYPE_LIVE_CHAT','TYPE_WEB_CHAT','TYPE_CHAT_WIDGET','CHAT_WIDGET']);
      const msgType = (m) => String(m.messageType || m.type || '').toUpperCase();
      const hasFB = msgs.some(m => FB_TYPES.has(msgType(m)));
      const hasIG = msgs.some(m => IG_TYPES.has(msgType(m)));
      const hasWebchat = msgs.some(m => WEBCHAT_TYPES.has(msgType(m)));
      setAvailableTypes(['SMS', ...(hasFB ? ['FB'] : []), ...(hasIG ? ['IG'] : []), ...(hasWebchat ? ['WEBCHAT'] : [])]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (loadingMore) return;
    setShouldScroll(false);
    setLoadingMore(true);
    try {
      const nextLimit = messages.length + 20;
      const token = localStorage.getItem("authToken");
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/leads/${lead.id}/conversations?limit=${nextLimit}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error("Failed to load more");
      const data = await response.json();
      const msgs = Array.isArray(data.messages?.messages)
        ? data.messages.messages
        : Array.isArray(data.messages)
        ? data.messages
        : [];
      setMessages([...msgs].reverse());
      setHasMore(msgs.length >= nextLimit);
    } catch (err) {
      console.error("Error loading more:", err);
    } finally {
      setLoadingMore(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-white z-[500] flex flex-col" style={{ bottom: keyboardOffset }}>
      {/* Softphone overlay */}
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
            onClick={onClose}
            className="p-2 rounded-full bg-blue-700 hover:bg-blue-800 transition flex-shrink-0"
            aria-label="Back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Contact info */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white truncate leading-tight">{name}</p>
            {phone && (
              <p className="text-blue-100 text-xs truncate">{formatPhoneNumber(phone)}</p>
            )}
          </div>

          {/* Call button — native app only */}
          {isNativeApp() && phone && (
            <button
              onClick={() => setPendingCall({ phone, name })}
              disabled={softphone.isActive}
              className="flex-shrink-0 w-9 h-9 rounded-full bg-green-500 hover:bg-green-600 disabled:opacity-40 flex items-center justify-center transition"
              title={`Call ${formatPhoneNumber(phone)}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
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
              onClick={() => fetchConversations()}
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
            contactName={name}
            companyId={companyId}
          />
        )}
      </div>

      {/* Reply box */}
      <div className="flex-shrink-0">
        {contactId ? (
          <ReplyBox
            conversationId={conversationId}
            contactId={contactId}
            channelType="SMS"
            availableTypes={availableTypes}
            onSent={() => fetchConversations()}
          />
        ) : (
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 text-center text-xs text-gray-400">
            This contact is not synced to GHL — messaging unavailable.
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
