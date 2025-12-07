// ============================================================================
// GHL Webhook Receiver - Minimal Debug Version
// ============================================================================

const express = require("express");
const router = express.Router();

// 1. Log ALL RAW REQUESTS
router.use(express.raw({ type: "*/*" }));

router.use((req, res, next) => {
  try {
    console.log("===== GHL WEBHOOK: RAW REQUEST RECEIVED =====");
    console.log("Headers:", req.headers);
    console.log("Raw Body:", req.body.toString());
    console.log("================================================");
  } catch (err) {
    console.log("RAW LOG ERROR:", err);
  }
  next();
});

// 2. Always respond safely
router.post("/:companyId", async (req, res) => {
  console.log(">>> Minimal webhook endpoint hit!");

  return res.status(200).json({
    ok: true,
    message: "webhook received"
  });
});

// 3. Test GET
router.get("/test", (req, res) => {
  return res.json({ ok: true, route: "minimal test OK" });
});

module.exports = router;
