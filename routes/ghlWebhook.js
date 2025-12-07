// ============================================================================
// GHL Webhook Receiver (Final, Safe, Production-Ready)
// ============================================================================

const express = require("express");
const router = express.Router();
const db = require("../config/database");

// 1. Capture raw body if STRING
router.use(express.raw({ type: "*/*" }));

router.use((req, res, next) => {
  console.log("===== GHL WEBHOOK RECEIVED =====");

  try {
    console.log("Headers:", req.headers);

    if (Buffer.isBuffer(req.body)) {
      console.log("Raw Body (string):", req.body.toString());
    } else if (typeof req.body === "object") {
      console.log("Raw Body (object):", JSON.stringify(req.body, null, 2));
    } else {
      console.log("Raw Body (other):", req.body);
    }
  } catch (err) {
    console.log("RAW LOG ERROR:", err);
  }

  console.log("=================================");

  next();
});

// 2. Try JSON parse AFTER logging
router.use((req, res, next) => {
  try {
    if (Buffer.isBuffer(req.body)) {
      req.json = JSON.parse(req.body.toString());
    } else if (typeof req.body === "object") {
      req.json = req.body;
    } else {
      req.json = {};
    }
  } catch (err) {
    console.log("JSON PARSE ERROR:", err);
    req.json = {};
  }
  next();
});

// 3. Test Endpoint
router.get("/test", (req, res) => {
  return res.json({ ok: true, route: "ghl webhook test" });
});

// ============================================================================
// MAIN WEBHOOK ENDPOINT
// ============================================================================
router.post("/:companyId", async (req, res) => {
  console.log(">>> Webhook endpoint hit.");

  const companyId = parseInt(req.params.companyId, 10);

  if (!companyId || Number.isNaN(companyId)) {
    console.log("ERROR: Invalid companyId");
    return res.status(400).json({ error: "Invalid companyId" });
  }

  const body = req.json || {};
  console.log("Parsed JSON:", JSON.stringify(body, null, 2));

  // Extract contact safely
  const contact =
    body.contact ||
    (body.payload && body.payload.contact) ||
    body;

  if (!contact || typeof contact !== "object") {
    console.log("ERROR: No contact object present.");
    return res.status(200).json({ received: true, skipped: "no_contact" });
  }

  const phone =
    contact.phone ||
    contact.phoneNumber ||
    (contact.phone && contact.phone.mobile) || // some GHL payloads
    null;

  const email = contact.email || null;

  console.log("CONTACT EXTRACTED:", { phone, email });

  // Prevent DB errors
  if (!phone) {
    console.log("ERROR: Missing phone. Skipping DB insert.");
    return res.status(200).json({
      received: true,
      skipped: "missing_phone"
    });
  }

  return res.status(200).json({
    received: true,
    companyId,
    phone,
    email
  });
});

module.exports = router;
