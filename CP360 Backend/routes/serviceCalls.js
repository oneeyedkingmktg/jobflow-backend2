// ============================================================================
// File: routes/serviceCalls.js
// Service Calls — per-lead additional install/visit dates
// ============================================================================

const express = require("express");
const router = express.Router({ mergeParams: true }); // mergeParams to get :leadId
const pool = require("../config/database");
const { authenticateToken } = require("../middleware/auth");

router.use(authenticateToken);

// ============================================================================
// GET /leads/:leadId/service-calls
// ============================================================================
router.get("/", async (req, res) => {
  try {
    const { leadId } = req.params;
    const companyId = req.user.company_id;

    // Verify lead belongs to this company (master bypasses)
    const leadCheck = await pool.query(
      "SELECT id FROM leads WHERE id = $1 AND (company_id = $2 OR $3 = 'master')",
      [leadId, companyId, req.user.role]
    );
    if (!leadCheck.rows.length) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const result = await pool.query(
      `SELECT id, lead_id, scheduled_date, scheduled_time, title, notes, created_at, updated_at
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
    const { scheduled_date, scheduled_time, title, notes } = req.body;

    // Verify lead belongs to this company
    const leadCheck = await pool.query(
      "SELECT id, company_id FROM leads WHERE id = $1 AND (company_id = $2 OR $3 = 'master')",
      [leadId, companyId, req.user.role]
    );
    if (!leadCheck.rows.length) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const leadCompanyId = leadCheck.rows[0].company_id;

    const result = await pool.query(
      `INSERT INTO service_calls (lead_id, company_id, scheduled_date, scheduled_time, title, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, lead_id, scheduled_date, scheduled_time, title, notes, created_at, updated_at`,
      [
        leadId,
        leadCompanyId,
        scheduled_date || null,
        scheduled_time || null,
        title || null,
        notes || null,
      ]
    );

    res.status(201).json({ serviceCall: result.rows[0] });
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
    const { scheduled_date, scheduled_time, title, notes } = req.body;

    // Verify ownership
    const existing = await pool.query(
      `SELECT sc.id FROM service_calls sc
       JOIN leads l ON l.id = sc.lead_id
       WHERE sc.id = $1 AND sc.lead_id = $2 AND (l.company_id = $3 OR $4 = 'master')`,
      [id, leadId, companyId, req.user.role]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: "Service call not found" });
    }

    const result = await pool.query(
      `UPDATE service_calls
       SET scheduled_date = $1, scheduled_time = $2, title = $3, notes = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING id, lead_id, scheduled_date, scheduled_time, title, notes, created_at, updated_at`,
      [
        scheduled_date || null,
        scheduled_time || null,
        title || null,
        notes || null,
        id,
      ]
    );

    res.json({ serviceCall: result.rows[0] });
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

    // Verify ownership
    const existing = await pool.query(
      `SELECT sc.id FROM service_calls sc
       JOIN leads l ON l.id = sc.lead_id
       WHERE sc.id = $1 AND sc.lead_id = $2 AND (l.company_id = $3 OR $4 = 'master')`,
      [id, leadId, companyId, req.user.role]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: "Service call not found" });
    }

    await pool.query("DELETE FROM service_calls WHERE id = $1", [id]);

    res.json({ message: "Service call deleted" });
  } catch (err) {
    console.error("Delete service call error:", err);
    res.status(500).json({ error: "Failed to delete service call" });
  }
});

module.exports = router;
