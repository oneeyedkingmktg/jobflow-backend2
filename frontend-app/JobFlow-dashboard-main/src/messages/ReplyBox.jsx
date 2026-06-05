// ============================================================================
// src/messages/ReplyBox.jsx
// Compose button + full-screen compose modal for SMS / scheduled SMS
// ============================================================================

import { useState, useRef } from "react";
import { apiRequest } from "../api";
import { useCompany } from "../CompanyContext";

const ALL_SEND_TYPES = [
  { value: "SMS",          label: "SMS" },
  { value: "FB",           label: "Facebook" },
  { value: "IG",           label: "Instagram" },
  { value: "WEBCHAT",      label: "Webchat" },
  { value: "SCHEDULE_SMS", label: "Schedule SMS" },
];

const TIME_SLOTS = (() => {
  const slots = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      const period = h < 12 ? "AM" : "PM";
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      slots.push({ value: `${hh}:${mm}`, label: `${h12}:${mm} ${period}` });
    }
  }
  return slots;
})();

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

  const [open,       setOpen]       = useState(false);
  const [message,    setMessage]    = useState("");
  const [type,       setType]       = useState(
    SEND_TYPES.find((t) => t.value === channelType) ? channelType : "SMS"
  );
  const [schedDate,  setSchedDate]  = useState("");
  const [schedTime,  setSchedTime]  = useState("");
  const [sending,    setSending]    = useState(false);
  const [error,      setError]      = useState(null);
  const textareaRef = useRef(null);

  const isScheduled = type === "SCHEDULE_SMS";

  function openModal() {
    setOpen(true);
    setError(null);
    setTimeout(() => {
      textareaRef.current?.focus();
      autoResize(textareaRef.current);
    }, 80);
  }

  function closeModal() {
    setOpen(false);
    setError(null);
    // message, schedDate, schedTime intentionally kept so text persists on reopen
  }

  function autoResize(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 320) + "px";
  }

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
        body.scheduledTimestamp = new Date(`${schedDate}T${schedTime}:00`).getTime();
      }

      await apiRequest("/api/messages/send", {
        method: "POST",
        body: JSON.stringify(body),
      });

      setMessage("");
      setSchedDate("");
      setSchedTime("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      closeModal();
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
    <>
      {/* ── Bottom bar: single compose button ── */}
      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <button
          onClick={openModal}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-base py-3 rounded-xl transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          Send Message
        </button>
      </div>

      {/* ── Compose modal ── */}
      {open && (
        <div
          className="fixed inset-0 z-[200] flex flex-col justify-end bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white rounded-t-2xl shadow-2xl flex flex-col"
            style={{ maxHeight: "90vh" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-base font-semibold text-gray-800">New Message</h2>
              <button
                onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Textarea */}
            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => { setMessage(e.target.value); autoResize(e.target); }}
                placeholder="Type your message here…"
                rows={6}
                className="w-full px-3 py-3 border border-gray-300 rounded-xl text-base resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ minHeight: "140px", maxHeight: "320px", fontSize: "16px", overflowY: "auto" }}
              />
            </div>

            {/* Error */}
            {error && (
              <p className="px-4 pb-1 text-sm text-red-500">{error}</p>
            )}

            {/* Schedule pickers — shown only when Schedule SMS is active */}
            {isScheduled && (
              <div className="px-4 pb-2 flex items-center gap-2 flex-wrap">
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
                  {TIME_SLOTS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Footer: channel selector + send button */}
            <div className="px-4 pb-6 pt-2 flex items-center gap-3 border-t border-gray-100 flex-shrink-0">
              <select
                value={type}
                onChange={(e) => { setType(e.target.value); setError(null); }}
                className="flex-1 border border-gray-300 rounded-xl px-3 py-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {SEND_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>

              <button
                onClick={handleSend}
                disabled={!message.trim() || sending || (isScheduled && (!schedDate || !schedTime))}
                className={`flex-shrink-0 w-12 h-12 flex items-center justify-center text-white rounded-xl transition disabled:opacity-40 ${
                  isScheduled
                    ? "bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300"
                    : "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300"
                }`}
                aria-label={isScheduled ? "Schedule" : "Send"}
              >
                {sending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isScheduled ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
