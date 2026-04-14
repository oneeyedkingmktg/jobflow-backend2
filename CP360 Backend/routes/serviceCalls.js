// ============================================================================
// File: routes/serviceCalls.js
// Service Calls — per-lead additional install/visit dates with GHL sync
// ============================================================================

const express = require("express");
const router = express.Router({ mergeParams: true });
const pool = require("../config/database");
const { authenticateToken } = require("../middleware/auth");
const { syncServiceCallToGhl, deleteServiceCallGhlEvent } = require("../controllers/ghlAPI");

router.use(authenticateToken);

// Fetch lead + company data needed for GHL sync
async function fetchLeadAndCompany(leadId) {
  const result = await pool.query(
    `SELECT
       l.id, l.name, l.ghl_contact_id, l.address, l.city, l.state, l.zip,
       c.id AS company_id, c.ghl_location_id, c.ghl_api_key,
       c.ghl_install_calendar, c.ghl_install_assigned_user,
       c.ghl_sc_calendar, c.ghl_sc_assigned_user,
       c.timezone
     FROM leads l
     JOIN companies c ON c.id = l.company_id
     WHERE l.id = $1`,
    [leadId]
  );
  if (!result.rows.length) return { lead: null, company: null };
  const row = result.rows[0];
  const lead = {
    id: row.id,
    name: row.name,
    ghl_contact_id: row.ghl_contact_id,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
  };
  const company = {
    id: row.company_id,
    ghl_location_id: row.ghl_location_id,
    ghl_api_key: row.ghl_api_key,
    ghl_install_calendar: row.ghl_install_calendar,
    ghl_install_assigned_user: row.ghl_install_assigned_user,
    ghl_sc_calendar: row.ghl_sc_calendar,
    ghl_sc_assigned_user: row.ghl_sc_assigned_user,
    timezone: row.timezone,
  };
  return { lead, company };
}

// ============================================================================
// GET /leads/:leadId/service-calls
// ============================================================================
router.get("/", async (req, res) => {
  try {
    const { leadId } = req.params;
    const companyId = req.user.company_id;

    const leadCheck = await pool.query(
      "SELECT id FROM leads WHERE id = $1 AND (company_id = $2 OR $3 = 'master')",
      [leadId, companyId, req.user.role]
    );
    if (!leadCheck.rows.length) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const result = await pool.query(
      `SELECT id, lead_id, scheduled_date, scheduled_end_date, scheduled_time, title, notes, ghl_event_id, created_at, updated_at
       FROM service_calls
       WHERE lead_id = $1
       ORDER BY scheduled_date ASC NULLS LAST, created_at ASC`,
      [leadId]
    );

    res.json({ serviceCalls: result.rows });
  } catch (err) {
    console.error("Get service calls error:", err);
    res.status(500).json({ error: "Failed to fetch service calls" });
  }
});

// ============================================================================
// POST /leads/:leadId/service-calls
// ============================================================================
router.post("/", async (req, res) => {
  try {
    const { leadId } = req.params;
    const companyId = req.user.company_id;
    const { scheduled_date, scheduled_end_date, scheduled_time, title, notes } = req.body;

    const leadCheck = await pool.query(
      "SELECT id, company_id FROM leads WHERE id = $1 AND (company_id = $2 OR $3 = 'master')",
      [leadId, companyId, req.user.role]
    );
    if (!leadCheck.rows.length) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const leadCompanyId = leadCheck.rows[0].company_id;

    // Insert the service call
    const result = await pool.query(
      `INSERT INTO service_calls (lead_id, company_id, scheduled_date, scheduled_end_date, scheduled_time, title, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, lead_id, scheduled_date, scheduled_end_date, scheduled_time, title, notes, ghl_event_id, created_at, updated_at`,
      [leadId, leadCompanyId, scheduled_date || null, scheduled_end_date || null, scheduled_time || null, title || null, notes || null]
    );

    const serviceCall = result.rows[0];

    // GHL sync — fire and forget, don't block the response
    if (scheduled_date) {
      fetchLeadAndCompany(leadId).then(async ({ lead, company }) => {
        try {
          const eventId = await syncServiceCallToGhl({ serviceCall, lead, company });
          if (eventId) {
            await pool.query(
              "UPDATE service_calls SET ghl_event_id = $1 WHERE id = $2",
              [eventId, serviceCall.id]
            );
          }
        } catch (err) {
          console.warn("[SC GHL POST] Sync failed (non-fatal):", err.message);
        }
      }).catch(() => {});
    }

    res.status(201).json({ serviceCall });
  } catch (err) {
    console.error("Create service call error:", err);
    res.status(500).json({ error: "Failed to create service call" });
  }
});

// ============================================================================
// PUT /leads/:leadId/service-calls/:id
// ============================================================================
router.put("/:id", async (req, res) => {
  try {
    const { leadId, id } = req.params;
    const companyId = req.user.company_id;
    const { scheduled_date, scheduled_end_date, scheduled_time, title, notes } = req.body;

    // Verify ownership and get existing ghl_event_id
    const existing = await pool.query(
      `SELECT sc.id, sc.ghl_event_id FROM service_calls sc
       JOIN leads l ON l.id = sc.lead_id
       WHERE sc.id = $1 AND sc.lead_id = $2 AND (l.company_id = $3 OR $4 = 'master')`,
      [id, leadId, companyId, req.user.role]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: "Service call not found" });
    }

    const result = await pool.query(
      `UPDATE service_calls
       SET scheduled_date = $1, scheduled_end_date = $2, scheduled_time = $3, title = $4, notes = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING id, lead_id, scheduled_date, scheduled_end_date, scheduled_time, title, notes, ghl_event_id, created_at, updated_at`,
      [scheduled_date || null, scheduled_end_date || null, scheduled_time || null, title || null, notes || null, id]
    );

    const serviceCall = result.rows[0];

    // GHL sync — fire and forget
    if (scheduled_date) {
      fetchLeadAndCompany(leadId).then(async ({ lead, company }) => {
        try {
          const eventId = await syncServiceCallToGhl({ serviceCall, lead, company });
          if (eventId) {
            await pool.query(
              "UPDATE service_calls SET ghl_event_id = $1 WHERE id = $2",
              [eventId, serviceCall.id]
            );
          }
        } catch (err) {
          console.warn("[SC GHL PUT] Sync failed (non-fatal):", err.message);
        }
      }).catch(() => {});
    }

    res.json({ serviceCall });
  } catch (err) {
    console.error("Update service call error:", err);
    res.status(500).json({ error: "Failed to update service call" });
  }
});

// ============================================================================
// DELETE /leads/:leadId/service-calls/:id
// ============================================================================
router.delete("/:id", async (req, res) => {
  try {
    const { leadId, id } = req.params;
    const companyId = req.user.company_id;

    // Fetch before deleting so we have the ghl_event_id
    const existing = await pool.query(
      `SELECT sc.id, sc.ghl_event_id, l.ghl_contact_id FROM service_calls sc
       JOIN leads l ON l.id = sc.lead_id
       WHERE sc.id = $1 AND sc.lead_id = $2 AND (l.company_id = $3 OR $4 = 'master')`,
      [id, leadId, companyId, req.user.role]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: "Service call not found" });
    }

    const { ghl_event_id, ghl_contact_id } = existing.rows[0];

    await pool.query("DELETE FROM service_calls WHERE id = $1", [id]);

    // Delete GHL event — fire and forget
    if (ghl_event_id) {
      fetchLeadAndCompany(leadId).then(async ({ company }) => {
        try {
          await deleteServiceCallGhlEvent({ company, eventId: ghl_event_id, contactId: ghl_contact_id });
        } catch (err) {
          console.warn("[SC GHL DELETE] Failed to delete GHL event (non-fatal):", err.message);
        }
      }).catch(() => {});
    }

    res.json({ message: "Service call deleted" });
  } catch (err) {
    console.error("Delete service call error:", err);
    res.status(500).json({ error: "Failed to delete service call" });
  }
});

module.exports = router;
