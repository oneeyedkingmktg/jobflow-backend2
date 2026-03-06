// ============================================================================
// routes/messages.js
// Phase 1 — Messages API routes
// ============================================================================

const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const { getConversations, getThreadMessages, lookupLeadByContact, markAsRead, sendMessage } = require("../controllers/messagesController");

router.get("/conversations", authenticateToken, getConversations);
router.get("/lead-lookup", authenticateToken, lookupLeadByContact);
router.get("/:conversationId/messages", authenticateToken, getThreadMessages);
router.put("/:conversationId/read", authenticateToken, markAsRead);
router.post("/send", authenticateToken, sendMessage);

module.exports = router;
