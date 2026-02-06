import { useState, useEffect, useRef } from "react";

export default function ConversationModal({ lead, onClose }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [shouldScroll, setShouldScroll] = useState(true);
  const messagesEndRef = useRef(null);

useEffect(() => {
    fetchConversations();
  }, [lead.id]);

useEffect(() => {
    if (shouldScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, shouldScroll]);

 const fetchConversations = async (limit = 10) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/leads/${lead.id}/conversations?limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch conversations");

      const data = await response.json();
      console.log("🔍 GHL Conversation Response:", data);
      const msgs = Array.isArray(data.messages?.messages) ? data.messages.messages : [];
      console.log("🔍 Messages array:", msgs);
      const reversed = [...msgs].reverse();
      setMessages(reversed);
      setHasMore(msgs.length >= limit);
      setShouldScroll(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

const loadMore = async () => {
    if (loadingMore) return;
    
    try {
      setShouldScroll(false);
      setLoadingMore(true);
      const currentCount = messages.length;
      const token = localStorage.getItem("authToken");
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/leads/${lead.id}/conversations?limit=${currentCount + 10}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to load more");

      const data = await response.json();
      const msgs = Array.isArray(data.messages?.messages) ? data.messages.messages : [];
      const reversed = [...msgs].reverse();
      setMessages(reversed);
      setHasMore(msgs.length >= currentCount + 10);
    } catch (err) {
      console.error("Error loading more:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            Conversation History - {lead.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="text-center py-8 text-gray-500">
              Loading messages...
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-red-600">
              Error: {error}
            </div>
          )}

          {!loading && !error && messages.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No messages found
            </div>
          )}

          {!loading && !error && messages.length > 0 && (
            <div className="space-y-4">
              {hasMore && (
                <button
                  onClick={loadMore}
                  className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 font-semibold"
                >
                  Fetch older messages
                </button>
              )}




{messages.map((msg, idx) => {
                const isEmail = msg.messageType === "TYPE_EMAIL";
                const isSMS = msg.messageType === "TYPE_SMS";
                const isCall = msg.messageType === "TYPE_CALL";
                const isWorkflow = msg.source === "workflow";
                const isSystemMessage = isEmail || isSMS;
                // Phone number formatter
// Phone number formatter
                const formatPhoneNumber = (phone) => {
                  const cleaned = phone.replace(/\D/g, '');
                  let digits = cleaned;
                  // Remove leading 1 if 11 digits (US country code)
                  if (digits.length === 11 && digits.startsWith('1')) {
                    digits = digits.slice(1);
                  }
                  if (digits.length === 10) {
                    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
                  }
                  return phone;
                };
                
// Get direction - for emails check meta.email.direction, fallback to root direction, default to outbound for system messages
                let direction = msg.direction;
                if (isEmail && msg.meta?.email?.direction) {
                  direction = msg.meta.email.direction;
                } else if (isCall) {
                  direction = "inbound"; // Calls are always customer inbound
                } else if (isSystemMessage && !direction) {
                  direction = "outbound";
                }
                
let displayText;
                if (isCall) {
                  const phoneNumber = msg.from || "Unknown";
                  displayText = `Incoming Call from: ${formatPhoneNumber(phoneNumber)}`;
                } else if (isEmail && msg.meta?.email?.subject) {
                  displayText = msg.meta.email.subject;
                } else {
                  displayText = msg.body;
                }
                
                return (
                  <div
                    key={idx}
                    className={`flex ${
                      direction === "outbound" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div className="flex items-start gap-2 max-w-[75%]">
                        {direction === "inbound" && (
                        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-700 flex-shrink-0">
                          Cu
                        </div>
                      )}
                      <div>
                        <div

 className={`p-3 rounded-lg ${
                            direction === "outbound"
                              ? isEmail
                                ? "bg-green-100 text-gray-800"
                                : isSMS
                                ? "bg-blue-100 text-gray-800"
                                : "bg-blue-600 text-white"
                              : isCall
                              ? "bg-gray-100 text-gray-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          <p className="text-sm">{displayText}</p>
                        </div>
                        <div className="text-xs text-gray-400 mt-1 px-1">
                          {new Date(msg.dateAdded).toLocaleString()}
                          {isWorkflow && <span className="ml-2 font-semibold">workflow</span>}
                        </div>
                      </div>
                        {direction === "outbound" && (
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          isEmail ? "bg-green-600 text-white" : isSMS ? "bg-blue-500 text-white" : "bg-blue-600 text-white"
                        }`}>
                          {isEmail ? "E" : isSMS ? "SMS" : "Co"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}