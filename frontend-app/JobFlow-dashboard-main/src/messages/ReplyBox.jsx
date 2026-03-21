// ============================================================================
// src/messages/ReplyBox.jsx
// Phase 3 — Reply input bar for ConversationThread
// ============================================================================

import { useState } from "react";
import { apiRequest } from "../api";
import { useCompany } from "../CompanyContext";

const ALL_SEND_TYPES = [
  { value: "SMS", label: "SMS" },
  { value: "FB", label: "Facebook" },
  { value: "IG", label: "Instagram" },
];

export default function ReplyBox({ conversationId, contactId, channelType, availableTypes, onSent }) {
  const { currentCompany } = useCompany();
  const SEND_TYPES = availableTypes?.length
    ? ALL_SEND_TYPES.filter((t) => availableTypes.includes(t.value))
    : ALL_SEND_TYPES.filter((t) => t.value === "SMS");
  const [message, setMessage] = useState("");
  const [type, setType] = useState(
    SEND_TYPES.find((t) => t.value === channelType) ? channelType : "SMS"
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  async function handleSend() {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      await apiRequest("/api/messages/send", {
        method: "POST",
        body: JSON.stringify({
          conversationId,
          contactId,
          message: trimmed,
          type,
          company_id: currentCompany?.id,
        }),
      });
      setMessage("");
      if (typeof onSent === "function") onSent();
    } catch (err) {
      console.error("Failed to send message:", err);
      setError("Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t border-gray-200 bg-white p-3 space-y-2">
      {error && (
        <p className="text-xs text-red-500 px-1">{error}</p>
      )}
      <div className="flex items-center gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="text-xs border border-gray-300 rounded-lg px-2 py-2 text-gray-700 bg-white flex-shrink-0"
        >
          {SEND_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ minHeight: "40px", maxHeight: "120px", fontSize: "16px" }}
        />
        <button
          onClick={handleSend}
          disabled={!message.trim() || sending}
          className="flex-shrink-0 p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl transition"
          aria-label="Send"
        >
          {sending ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
