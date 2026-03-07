import { useState, useEffect } from "react";
import MessageList from "../messages/MessageList.jsx";
import { useCompany } from "../CompanyContext";

export default function ConversationModal({ lead, onClose }) {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [shouldScroll, setShouldScroll] = useState(true);

  useEffect(() => {
    fetchConversations();
  }, [lead.id]);

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

          {!loading && !error && (
            <MessageList
              messages={messages}
              hasMore={hasMore}
              onLoadMore={loadMore}
              loadingMore={loadingMore}
              autoScroll={shouldScroll}
              contactName={lead.name || lead.fullName}
              companyId={companyId}
            />
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