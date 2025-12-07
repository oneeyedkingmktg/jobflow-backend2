// ============================================================================
// GHL Webhook Receiver - Step 1: Basic Listener
// ============================================================================
const express = require("express");
const router = express.Router();

// This route will be called directly by GoHighLevel webhooks.
router.post("/", async (req, res) => {
  try {
    console.log("===== GHL WEBHOOK RECEIVED =====");
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);
    console.log("================================");

    // Respond immediately so GHL stops retrying
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook Error:", error);
    return res.status(500).json({ error: "Webhook processing error" });
  }
});

module.exports = router;
