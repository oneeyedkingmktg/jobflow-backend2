// ============================================================================
// controllers/messagesController.js
// Phase 1 — Fetch conversation list from GHL for the Messages screen
// ============================================================================

const pool = require("../config/database");
const { searchConversations, getConversationById, getMessagesByConversationId, markConversationRead, sendMessage: sendMessageGHL, proxyCallRecording, getCallTranscription } = require("./ghlAPI");

// GET /api/messages/conversations
async function getConversations(req, res) {
  try {
    const companyId = req.query.company_id || req.user?.company_id;

    if (!companyId) {
      return res.status(400).json({ error: "company_id required" });
    }

    // Access control: non-master users can only access their own company
    if (
      req.user.role !== "master" &&
      parseInt(req.user.company_id) !== parseInt(companyId)
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Load company GHL credentials
    const companyResult = await pool.query(
      `SELECT id, ghl_api_key, ghl_location_id
       FROM companies
       WHERE id = $1 AND deleted_at IS NULL`,
      [companyId]
    );

    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    const company = companyResult.rows[0];

    if (!company.ghl_api_key || !company.ghl_location_id) {
      return res.json({ conversations: [] });
    }

    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const ghlResponse = await searchConversations(company, { limit });

    const conversations = (ghlResponse?.conversations || []).map((c) => ({
      id: c.id,
      contactId: c.contactId,
      contactName: c.fullName || c.contactName || "Unknown",
      phone: c.phone || "",
      email: c.email || "",
      lastMessageBody: c.lastMessageBody || "",
      lastMessageDate: c.lastMessageDate || c.dateUpdated || null,
      unreadCount: c.unreadCount || 0,
      lastMessageType: c.lastMessageType || c.type || "SMS",
      channelType: c.type || c.lastMessageType || "SMS",
    }));

    res.json({ conversations });
  } catch (error) {
    console.error("Error fetching conversations from GHL:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
}

// GET /api/messages/:conversationId/messages
async function getThreadMessages(req, res) {
  try {
    const { conversationId } = req.params;
    const companyId = req.query.company_id || req.user?.company_id;

    if (!companyId) {
      return res.status(400).json({ error: "company_id required" });
    }

    if (
      req.user.role !== "master" &&
      parseInt(req.user.company_id) !== parseInt(companyId)
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    const companyResult = await pool.query(
      `SELECT id, ghl_api_key, ghl_location_id
       FROM companies
       WHERE id = $1 AND deleted_at IS NULL`,
      [companyId]
    );

    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    const company = companyResult.rows[0];

    if (!company.ghl_api_key || !company.ghl_location_id) {
      return res.json({ messages: [] });
    }

    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const ghlResponse = await getMessagesByConversationId(conversationId, company, limit);
    const raw = ghlResponse?.messages || [];
    const messages = Array.isArray(raw) ? raw : (Array.isArray(raw?.messages) ? raw.messages : []);

    res.json({ messages });
  } catch (error) {
    console.error("Error fetching thread messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
}

// GET /api/messages/lead-lookup?contactId=X&company_id=Y
async function lookupLeadByContact(req, res) {
  try {
    const { contactId, company_id } = req.query;
    const companyId = company_id || req.user?.company_id;

    if (!contactId || !companyId) {
      return res.status(400).json({ error: "contactId and company_id required" });
    }

    if (
      req.user.role !== "master" &&
      parseInt(req.user.company_id) !== parseInt(companyId)
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    let result = await pool.query(
      `SELECT id, full_name, first_name, last_name, phone
       FROM leads
       WHERE company_id = $1
         AND ghl_contact_id = $2
         AND deleted_at IS NULL
       LIMIT 1`,
      [companyId, contactId]
    );

    // Fallback: match by phone number if no ghl_contact_id match
    if (result.rows.length === 0 && req.query.phone) {
      const rawPhone = req.query.phone.replace(/[^\d]/g, "");
      result = await pool.query(
        `SELECT id, full_name, first_name, last_name, phone
         FROM leads
         WHERE company_id = $1
           AND deleted_at IS NULL
           AND regexp_replace(phone, '[^0-9]', '', 'g') = $2
         LIMIT 1`,
        [companyId, rawPhone]
      );
    }

    if (result.rows.length === 0) {
      return res.json({ lead: null });
    }

    const row = result.rows[0];
    res.json({
      lead: {
        id: row.id,
        name: row.full_name || `${row.first_name || ""} ${row.last_name || ""}`.trim(),
        phone: row.phone,
      },
    });
  } catch (error) {
    console.error("Error looking up lead by contact:", error);
    res.status(500).json({ error: "Failed to look up lead" });
  }
}

// PUT /api/messages/:conversationId/read
async function markAsRead(req, res) {
  try {
    const { conversationId } = req.params;
    const companyId = req.query.company_id || req.user?.company_id;

    if (!companyId) return res.status(400).json({ error: "company_id required" });

    if (req.user.role !== "master" && parseInt(req.user.company_id) !== parseInt(companyId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const companyResult = await pool.query(
      `SELECT id, ghl_api_key, ghl_location_id FROM companies WHERE id = $1 AND deleted_at IS NULL`,
      [companyId]
    );

    if (companyResult.rows.length === 0) return res.status(404).json({ error: "Company not found" });

    const company = companyResult.rows[0];
    if (!company.ghl_api_key || !company.ghl_location_id) return res.json({ success: true });

    await markConversationRead(conversationId, company);
    res.json({ success: true });
  } catch (error) {
    // Non-fatal — log but return success so UI still updates
    console.error("Error marking conversation as read:", error.message);
    res.json({ success: true });
  }
}

// POST /api/messages/send
async function sendMessage(req, res) {
  try {
    let { conversationId, contactId, message, type, scheduledTimestamp } = req.body;
    const companyId = req.body.company_id || req.user?.company_id;

    if (!message || !companyId) {
      return res.status(400).json({ error: "message and company_id required" });
    }
    if (!contactId && !conversationId) {
      return res.status(400).json({ error: "contactId or conversationId required" });
    }

    if (req.user.role !== "master" && parseInt(req.user.company_id) !== parseInt(companyId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const companyResult = await pool.query(
      `SELECT id, ghl_api_key, ghl_location_id FROM companies WHERE id = $1 AND deleted_at IS NULL`,
      [companyId]
    );

    if (companyResult.rows.length === 0) return res.status(404).json({ error: "Company not found" });

    const company = companyResult.rows[0];
    if (!company.ghl_api_key || !company.ghl_location_id) {
      return res.status(400).json({ error: "Company not configured for messaging" });
    }

    // If contactId missing but conversationId is known, fetch contactId from GHL
    if (!contactId && conversationId) {
      const conv = await getConversationById(conversationId, company);
      contactId = conv?.contactId || null;
    }

    // If no conversationId, look it up from GHL by contactId
    if (!conversationId && contactId) {
      const convSearch = await searchConversations(company, { contactId, limit: 1 });
      conversationId = convSearch?.conversations?.[0]?.id || null;
    }

    if (!conversationId) {
      return res.status(400).json({ error: "No conversation found for this contact. Send a message from GHL first to create one." });
    }
    if (!contactId) {
      return res.status(400).json({ error: "Could not resolve contactId for this conversation." });
    }

    // Normalize frontend type values to GHL-accepted send enum values
    const GHL_TYPE_MAP = {
      WEBCHAT: "Live_Chat", TYPE_WEBCHAT: "Live_Chat", LIVE_CHAT: "Live_Chat",
      TYPE_LIVE_CHAT: "Live_Chat", TYPE_WEB_CHAT: "Live_Chat",
      TYPE_CHAT_WIDGET: "Live_Chat", CHAT_WIDGET: "Live_Chat",
    };
    const ghlType = GHL_TYPE_MAP[(type || "").toUpperCase()] || type || "SMS";

    const ghlPayload = {
      type: ghlType,
      conversationId,
      contactId,
      message,
      locationId: company.ghl_location_id,
    };
    if (scheduledTimestamp) ghlPayload.scheduledTimestamp = Math.floor(Number(scheduledTimestamp) / 1000);
    const ghlResponse = await sendMessageGHL(company, ghlPayload);

    res.json({ success: true, messageId: ghlResponse?.messageId || null });
  } catch (error) {
    console.error("Error sending message:", error);
    const ghlError = error?.response ? JSON.stringify(error.response) : error.message;
    res.status(500).json({ error: "Failed to send message", detail: ghlError });
  }
}

// GET /api/messages/:messageId/recording  — proxies binary audio from GHL
async function getRecording(req, res) {
  try {
    const { messageId } = req.params;
    const companyId = req.query.company_id || req.user?.company_id;
    if (!companyId) return res.status(400).json({ error: "company_id required" });
    if (req.user.role !== "master" && parseInt(req.user.company_id) !== parseInt(companyId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const companyResult = await pool.query(
      `SELECT id, ghl_api_key, ghl_location_id FROM companies WHERE id = $1 AND deleted_at IS NULL`,
      [companyId]
    );
    if (companyResult.rows.length === 0) return res.status(404).json({ error: "Company not found" });
    const company = companyResult.rows[0];
    if (!company.ghl_api_key || !company.ghl_location_id) return res.status(404).json({ error: "Not configured" });
    await proxyCallRecording(messageId, company, res);
  } catch (error) {
    console.error("Error fetching call recording:", error.message);
    if (!res.headersSent) res.status(500).json({ error: "Failed to fetch recording" });
  }
}

// GET /api/messages/:messageId/transcription
async function getTranscription(req, res) {
  try {
    const { messageId } = req.params;
    const companyId = req.query.company_id || req.user?.company_id;
    if (!companyId) return res.status(400).json({ error: "company_id required" });
    if (req.user.role !== "master" && parseInt(req.user.company_id) !== parseInt(companyId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const companyResult = await pool.query(
      `SELECT id, ghl_api_key, ghl_location_id FROM companies WHERE id = $1 AND deleted_at IS NULL`,
      [companyId]
    );
    if (companyResult.rows.length === 0) return res.status(404).json({ error: "Company not found" });
    const company = companyResult.rows[0];
    if (!company.ghl_api_key || !company.ghl_location_id) return res.json({ text: null });
    const data = await getCallTranscription(messageId, company);
    // GHL returns an array of sentence objects at the root level
let text = null;
    if (Array.isArray(data)) {
      text = data.map((s) => s.transcript || s.text || "").filter(Boolean).join("\n\n");
    } else if (typeof data === "string") {
      text = data;
    } else if (data?.text && typeof data.text === "string") {
      text = data.text;
    } else if (data?.transcript && typeof data.transcript === "string") {
      text = data.transcript;
    } else if (Array.isArray(data?.transcription)) {
      text = data.transcription.map((s) => s.transcript || s.text || "").join(" ").trim();
    } else if (Array.isArray(data?.segments)) {
      text = data.segments.map((s) => s.transcript || s.text || "").join(" ").trim();
    }

    res.json({ text: text || null });
  } catch (error) {
    console.error("Error fetching call transcription:", error.message);
    res.json({ text: null });
  }
}

// GET /api/messages/check-update?conversationId=X&company_id=Y
async function checkUpdate(req, res) {
  try {
    const { conversationId } = req.query;
    const companyId = req.query.company_id || req.user?.company_id;

    if (!conversationId || !companyId) {
      return res.status(400).json({ error: "conversationId and company_id required" });
    }

    if (req.user.role !== "master" && parseInt(req.user.company_id) !== parseInt(companyId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const result = await pool.query(
      `SELECT last_message_at FROM conversation_updates
       WHERE conversation_id = $1 AND company_id = $2`,
      [conversationId, companyId]
    );

    res.json({ lastMessageAt: result.rows[0]?.last_message_at || null });
  } catch (error) {
    console.error("Error checking conversation update:", error);
    res.status(500).json({ error: "Failed to check update" });
  }
}

module.exports = { getConversations, getThreadMessages, lookupLeadByContact, markAsRead, sendMessage, getRecording, getTranscription, checkUpdate };
