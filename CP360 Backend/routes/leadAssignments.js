// ============================================================================
// File: routes/leadAssignments.js
// Employee/crew assignments on a specific lead (job)
// Mounted at: /leads/:leadId/assignments
// ============================================================================

const express = require("express");
const router = express.Router({ mergeParams: true });
const db = require("../config/database");
const { authenticateToken } = require("../middleware/auth");

router.use(authenticateToken);

const VALID_ROLES = ["installer", "lead", "helper", "subcontractor"];

// ============================================================================
// GET /leads/:leadId/assignments — list all assignments for this job
// ============================================================================
router.get("/", async (req, res) => {
  try {
    const leadId = parseInt(req.params.leadId, 10);

    const result = await db.query(
      `SELECT
         la.id, la.user_id, la.crew_id, la.assignment_role, la.assigned_at,
         u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
         c.name AS crew_name, c.color AS crew_color
       FROM lead_assignments la
       JOIN users u ON u.id = la.user_id
       LEFT JOIN crews c ON c.id = la.crew_id
       WHERE la.lead_id = $1
       ORDER BY la.assignment_role ASC, u.name ASC`,
      [leadId]
    );

    const assignments = result.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      userEmail: r.user_email,
      userPhone: r.user_phone,
      crewId: r.crew_id,
      crewName: r.crew_name,
      crewColor: r.crew_color,
      role: r.assignment_role,
      assignedAt: r.assigned_at,
    }));

    res.json({ assignments });
  } catch (err) {
    console.error("Get assignments error:", err);
    res.status(500).json({ error: "Failed to fetch assignments" });
  }
});

// ============================================================================
// POST /leads/:leadId/assignments — add one employee or bulk-add a whole crew
// Body: { user_id, role } — single employee
//   OR: { crew_id, role } — bulk-add all active crew members
// ============================================================================
router.post("/", async (req, res) => {
  try {
    const leadId = parseInt(req.params.leadId, 10);
    const { user_id, crew_id, role = "installer" } = req.body;

    if (!user_id && !crew_id) {
      return res.status(400).json({ error: "user_id or crew_id is required" });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` });
    }

    // Fetch lead to get company_id
    const leadRow = await db.query(
      "SELECT company_id FROM leads WHERE id = $1 AND deleted_at IS NULL",
      [leadId]
    );
    if (!leadRow.rows.length) return res.status(404).json({ error: "Lead not found" });
    const companyId = leadRow.rows[0].company_id;

    const added = [];

    if (crew_id) {
      // Bulk-add all active members of the crew
      const members = await db.query(
        `SELECT cm.user_id, cm.is_lead, u.name, u.email, u.phone
         FROM crew_members cm
         JOIN users u ON u.id = cm.user_id AND u.deleted_at IS NULL AND u.is_active = true
         WHERE cm.crew_id = $1`,
        [crew_id]
      );

      for (const m of members.rows) {
        const memberRole = m.is_lead ? "lead" : role;
        await db.query(
          `INSERT INTO lead_assignments (lead_id, company_id, user_id, crew_id, assignment_role)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (lead_id, user_id) DO NOTHING`,
          [leadId, companyId, m.user_id, crew_id, memberRole]
        );
        added.push({ userId: m.user_id, name: m.name, role: memberRole });
      }
    } else {
      // Single employee
      const userRow = await db.query(
        "SELECT id, name, email, phone FROM users WHERE id = $1 AND deleted_at IS NULL",
        [user_id]
      );
      if (!userRow.rows.length) return res.status(404).json({ error: "User not found" });

      await db.query(
        `INSERT INTO lead_assignments (lead_id, company_id, user_id, crew_id, assignment_role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (lead_id, user_id) DO NOTHING`,
        [leadId, companyId, user_id, null, role]
      );

      const u = userRow.rows[0];
      added.push({ userId: u.id, name: u.name, role });
    }

    // Return full updated assignment list
    const updated = await db.query(
      `SELECT
         la.id, la.user_id, la.crew_id, la.assignment_role, la.assigned_at,
         u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
         c.name AS crew_name, c.color AS crew_color
       FROM lead_assignments la
       JOIN users u ON u.id = la.user_id
       LEFT JOIN crews c ON c.id = la.crew_id
       WHERE la.lead_id = $1
       ORDER BY la.assignment_role ASC, u.name ASC`,
      [leadId]
    );

    const assignments = updated.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      userEmail: r.user_email,
      userPhone: r.user_phone,
      crewId: r.crew_id,
      crewName: r.crew_name,
      crewColor: r.crew_color,
      role: r.assignment_role,
      assignedAt: r.assigned_at,
    }));

    res.status(201).json({ assignments, added });
  } catch (err) {
    console.error("Add assignment error:", err);
    res.status(500).json({ error: "Failed to add assignment" });
  }
});

// ============================================================================
// PUT /leads/:leadId/assignments/:userId — update assignment role
// ============================================================================
router.put("/:userId", async (req, res) => {
  try {
    const leadId = parseInt(req.params.leadId, 10);
    const userId = parseInt(req.params.userId, 10);
    const { role } = req.body;

    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` });
    }

    const result = await db.query(
      `UPDATE lead_assignments SET assignment_role = $1
       WHERE lead_id = $2 AND user_id = $3
       RETURNING id`,
      [role, leadId, userId]
    );

    if (!result.rows.length) return res.status(404).json({ error: "Assignment not found" });
    res.json({ message: "Assignment updated" });
  } catch (err) {
    console.error("Update assignment error:", err);
    res.status(500).json({ error: "Failed to update assignment" });
  }
});

// ============================================================================
// DELETE /leads/:leadId/assignments/:userId — remove an assignment
// ============================================================================
router.delete("/:userId", async (req, res) => {
  try {
    const leadId = parseInt(req.params.leadId, 10);
    const userId = parseInt(req.params.userId, 10);

    await db.query(
      "DELETE FROM lead_assignments WHERE lead_id = $1 AND user_id = $2",
      [leadId, userId]
    );

    res.json({ message: "Assignment removed" });
  } catch (err) {
    console.error("Remove assignment error:", err);
    res.status(500).json({ error: "Failed to remove assignment" });
  }
});

module.exports = router;
