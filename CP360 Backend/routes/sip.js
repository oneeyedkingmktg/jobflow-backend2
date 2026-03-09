// ============================================================================
// File: routes/sip.js
// SIP credentials endpoint — returns decrypted creds for native softphone
// ============================================================================
const express = require("express");
const CryptoJS = require("crypto-js");
const db = require("../config/database");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();
router.use(authenticateToken);

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "change-this-encryption-key";

const decryptSipPassword = (enc) => {
  if (!enc) return null;
  try {
    const decrypted = CryptoJS.AES.decrypt(enc, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
    // If decryption produces a valid string, use it; otherwise treat as plaintext (dev/manual entry)
    if (decrypted && decrypted.length >= 4) return decrypted;
    return enc; // fallback: return as-is (plaintext saved directly in DB)
  } catch { return enc; } // fallback: return as-is
};

// ============================================================================
// GET /api/sip/credentials
// Returns decrypted SIP credentials for the current user + company SIP domain.
// Used exclusively by the native Capacitor softphone plugin.
// ============================================================================
router.get("/credentials", async (req, res) => {
  try {
    const userId = req.user.id;
    // Master admin can pass company_id to get SIP domain for the company they're viewing
    const companyId = (req.user.role === 'master' && req.query.company_id)
      ? parseInt(req.query.company_id)
      : req.user.company_id;

    // Fetch user SIP fields + company SIP domain in one query
    const result = await db.query(
      `SELECT
         u.sip_username,
         u.sip_password,
         u.sip_incoming_enabled,
         c.sip_domain
       FROM users u
       JOIN companies c ON c.id = u.company_id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const row = result.rows[0];

    if (!row.sip_domain || !row.sip_username || !row.sip_password) {
      return res.status(404).json({ error: "SIP not configured for this account" });
    }

    res.json({
      sip_domain: row.sip_domain,
      sip_username: row.sip_username,
      sip_password: decryptSipPassword(row.sip_password),
      sip_incoming_enabled: row.sip_incoming_enabled ?? false,
    });
  } catch (err) {
    console.error("SIP credentials error:", err);
    res.status(500).json({ error: "Failed to fetch SIP credentials" });
  }
});

module.exports = router;
