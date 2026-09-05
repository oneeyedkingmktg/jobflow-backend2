// ============================================================================
// routes/ghl.js (v4.1) – Multi-Company GHL Proxy Routes
// FIXED:
// - Correct company calendar field names
//   • ghl_appt_calendar
//   • ghl_install_calendar
// ============================================================================

const express = require("express");
const router = express.Router();
const db = require("../config/database");
const ghl = require("../controllers/ghlAPI");
const { authenticateToken } = require("../middleware/auth");

// ============================================================================
// LOAD COMPANY MIDDLEWARE (VALIDATES + PROVIDES GHL CREDS + CALENDARS)
// ============================================================================

async function loadCompany(req, res, next) {
  const companyId = req.headers["x-company-id"];

  if (!companyId) {
    return res.status(400).json({ error: "Missing x-company-id header" });
  }

  try {
    const result = await db.query(
      `
      SELECT
        id,
        company_name,
        ghl_api_key,
        ghl_location_id,
        ghl_appt_calendar,
        ghl_install_calendar,
        billing_status,
        monthly_price,
        setup_fee_paid,
        created_at,
        updated_at
      FROM companies
      WHERE id = $1
        AND deleted_at IS NULL
      `,
      [companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Attach company record to request
    req.company = result.rows[0];
    next();
  } catch (err) {
    console.error("Company lookup error:", err);
    return res.status(500).json({ error: "Database error loading company" });
  }
}

// ============================================================================
// LIST GHL CALENDARS FOR A LOCATION
// GET /ghl/calendars — uses JWT auth, resolves company from token
// ============================================================================

router.get("/calendars", async (req, res) => {
  try {
    const companyId =
      req.user.role === "master"
        ? parseInt(req.query.company_id, 10) || req.user.company_id
        : req.user.company_id;

    if (!companyId) return res.status(400).json({ error: "company_id required" });

    const companyResult = await db.query(
      `SELECT id, ghl_api_key, ghl_location_id, timezone FROM companies WHERE id = $1 AND deleted_at IS NULL`,
      [companyId]
    );
    if (!companyResult.rows.length) return res.status(404).json({ error: "Company not found" });

    const result = await ghl.listCalendars(companyResult.rows[0]);
    return res.json(result);
  } catch (err) {
    console.error("GHL calendars error:", err);
    return res.status(500).json({ error: "Failed to fetch GHL calendars" });
  }
});

// ============================================================================
// LIST PIPELINES FOR A LOCATION
// GET /ghl/pipelines — uses JWT auth, resolves company from token
// ============================================================================

router.get("/pipelines", async (req, res) => {
  try {
    const companyId =
      req.user.role === "master"
        ? parseInt(req.query.company_id, 10) || req.user.company_id
        : req.user.company_id;

    if (!companyId) return res.status(400).json({ error: "company_id required" });

    const companyResult = await db.query(
      `SELECT id, ghl_api_key, ghl_location_id FROM companies WHERE id = $1 AND deleted_at IS NULL`,
      [companyId]
    );
    if (!companyResult.rows.length) return res.status(404).json({ error: "Company not found" });

    const result = await ghl.listPipelines(companyResult.rows[0]);
    return res.json(result);
  } catch (err) {
    console.error("GHL pipelines error:", err.message || err);
    return res.status(500).json({ error: err.message || "Failed to fetch GHL pipelines" });
  }
});

// ============================================================================
// SEARCH CONTACT BY PHONE
// GET /ghl/search-by-phone?phone=xxx
// ============================================================================

router.get("/search-by-phone", loadCompany, async (req, res) => {
  try {
    const phone = req.query.phone || "";

    const result = await ghl.searchGHLContactByPhone(phone, req.company);

    return res.json(result);
  } catch (err) {
    console.error("GHL search-by-phone error:", err);
    return res.status(500).json({ error: "Search failed" });
  }
});

// ============================================================================
// SYNC LEAD INTO GHL
// POST /ghl/sync-lead
// ============================================================================

router.post("/sync-lead", loadCompany, async (req, res) => {
  try {
    const lead = req.body;

    if (!lead || !lead.id) {
      return res.status(400).json({
        error: "Invalid lead payload (missing id)",
      });
    }

    const contact = await ghl.syncLeadToGHL(lead, req.company);

    return res.json({
      status: "success",
      contact,
    });
  } catch (err) {
    console.error("GHL sync error:", err);
    return res.status(500).json({ error: "Sync failed" });
  }
});

// ============================================================================
// FETCH CONTACT BY GHL ID
// GET /ghl/contact/:id
// ============================================================================

router.get("/contact/:id", loadCompany, async (req, res) => {
  try {
    const contact = await ghl.fetchGHLContact(
      req.params.id,
      req.company
    );

    return res.json(contact);
  } catch (err) {
    console.error("GHL fetch contact error:", err);
    return res.status(500).json({ error: "Fetch failed" });
  }
});

module.exports = router;
