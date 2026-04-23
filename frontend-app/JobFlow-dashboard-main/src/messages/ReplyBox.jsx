// ============================================================================
// src/messages/ReplyBox.jsx
// Phase 3 — Reply input bar for ConversationThread
// ============================================================================

import { useState } from "react";
import { apiRequest } from "../api";
import { useCompany } from "../CompanyContext";

const ALL_SEND_TYPES = [
  { value: "SMS",          label: "SMS" },
  { value: "FB",           label: "Facebook" },
  { value: "IG",           label: "Instagram" },
  { value: "SCHEDULE_SMS", label: "Schedule SMS" },
];

// All 15-minute time slots as { value: "HH:MM", label: "h:MM AM/PM" }
const TIME_SLOTS = (() => {
  const slots = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const period = h < 12 ? 'AM' : 'PM';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      slots.push({ value: `${hh}:${mm}`, label: `${h12}:${mm} ${period}` });
    }
  }
  return slots;
})();

// Today's date in YYYY-MM-DD for the date input min
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReplyBox({ conversationId, contactId, channelType, availableTypes, onSent }) {
  const { currentCompany } = useCompany();

  const SEND_TYPES = availableTypes?.length
    ? [
        ...ALL_SEND_TYPES.filter((t) => t.value !== "SCHEDULE_SMS" && availableTypes.includes(t.value)),
        ALL_SEND_TYPES.find((t) => t.value === "SCHEDULE_SMS"),
      ]
    : ALL_SEND_TYPES.filter((t) => t.value === "SMS" || t.value === "SCHEDULE_SMS");

  const [message,     setMessage]     = useState("");
  const [type,        setType]        = useState(
    SEND_TYPES.find((t) => t.value === channelType) ? channelType : "SMS"
  );
  const [schedDate,   setSchedDate]   = useState("");
  const [schedTime,   setSchedTime]   = useState("");
  const [sending,     setSending]     = useState(false);
  const [error,       setError]       = useState(null);

  const isScheduled = type === "SCHEDULE_SMS";

  async function handleSend() {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    if (isScheduled && (!schedDate || !schedTime)) {
      setError("Please pick a date and time to schedule the message.");
      return;
    }

    setSending(true);
    setError(null);
    try {
      const body = {
        conversationId,
        contactId,
        message: trimmed,
        type: isScheduled ? "SMS" : type,
        company_id: currentCompany?.id,
      };

      if (isScheduled) {
        // GHL expects Unix timestamp in milliseconds
        body.scheduledTimestamp = new Date(`${schedDate}T${schedTime}:00`).getTime();
      }

      await apiRequest("/api/messages/send", {
        method: "POST",
        body: JSON.stringify(body),
      });

      setMessage("");
      setSchedDate("");
      setSchedTime("");
      if (typeof onSent === "function") onSent();
    } catch (err) {
      console.error("Failed to send message:", err);
      const detail = err?.detail || err?.message || "";
      setError(detail ? `Failed to send: ${detail}` : "Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-gray-200 bg-white p-3 space-y-2">
      {error && (
        <p className="text-xs text-red-500 px-1">{error}</p>
      )}

      {/* Schedule date/time picker — shown only when Schedule SMS is selected */}
      {isScheduled && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-gray-500 whitespace-nowrap">Send at:</span>
          <input
            type="date"
            value={schedDate}
            min={todayStr()}
            onChange={(e) => setSchedDate(e.target.value)}
            className="px-2 py-1.5 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <select
            value={schedTime}
            onChange={(e) => setSchedTime(e.target.value)}
            className="px-2 py-1.5 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          >
            <option value="" disabled>Time</option>
            {TIME_SLOTS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button
            onClick={() => { setType("SMS"); setSchedDate(""); setSchedTime(""); setError(null); }}
            className="text-xs text-gray-400 hover:text-red-500 transition whitespace-nowrap px-1"
            title="Cancel scheduled send"
          >
            ✕ Cancel
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <select
          value={type}
          onChange={(e) => { setType(e.target.value); setError(null); }}
          className="text-xs border border-gray-300 rounded-lg px-2 py-2 text-gray-700 bg-white flex-shrink-0"
        >
          {SEND_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={isScheduled ? "Type a message to schedule…" : "Type a message…"}
          rows={1}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ minHeight: "40px", maxHeight: "120px", fontSize: "16px" }}
        />

        <button
          onClick={handleSend}
          disabled={!message.trim() || sending || (isScheduled && (!schedDate || !schedTime))}
          className={`flex-shrink-0 p-2 text-white rounded-xl transition disabled:opacity-40 ${
            isScheduled ? "bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300" : "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300"
          }`}
          aria-label={isScheduled ? "Schedule" : "Send"}
        >
          {sending ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isScheduled ? (
            // Clock icon for scheduled
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
            </svg>
          ) : (
            // Send icon
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
