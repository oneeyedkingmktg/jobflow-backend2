// ============================================================================
// File: routes/crews.js
// CRUD for company crews + crew member management
// ============================================================================

const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { authenticateToken, requireRole } = require("../middleware/auth");

router.use(authenticateToken);

function resolveCompanyId(req) {
  if (req.user.role === "master") {
    const id = req.query.company_id || (req.body && req.body.company_id);
    if (id) return parseInt(id, 10);
  }
  return req.user.company_id;
}

// ============================================================================
// GET /api/crews — list all crews with their members
// ============================================================================
router.get("/", async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "company_id required" });

    const crews = await db.query(
      `SELECT id, company_id, name, color, is_active, ghl_calendar_id, created_at
       FROM crews
       WHERE company_id = $1
       ORDER BY name ASC`,
      [companyId]
    );

    if (!crews.rows.length) return res.json({ crews: [] });

    const crewIds = crews.rows.map((c) => c.id);

    const members = await db.query(
      `SELECT cm.crew_id, cm.is_lead, u.id AS user_id, u.name, u.email, u.phone, u.is_active
       FROM crew_members cm
       JOIN users u ON u.id = cm.user_id AND u.deleted_at IS NULL
       WHERE cm.crew_id = ANY($1)
       ORDER BY cm.is_lead DESC, u.name ASC`,
      [crewIds]
    );

    const membersByCrewId = {};
    for (const m of members.rows) {
      if (!membersByCrewId[m.crew_id]) membersByCrewId[m.crew_id] = [];
      membersByCrewId[m.crew_id].push({
        userId: m.user_id,
        name: m.name,
        email: m.email,
        phone: m.phone,
        isActive: m.is_active,
        isLead: m.is_lead,
      });
    }

    const result = crews.rows.map((c) => ({
      ...c,
      members: membersByCrewId[c.id] || [],
    }));

    res.json({ crews: result });
  } catch (err) {
    console.error("Get crews error:", err);
    res.status(500).json({ error: "Failed to fetch crews" });
  }
});

// ============================================================================
// GET /api/crews/lead-assignments — crew assignments for all leads (calendar use)
// Returns { assignments: { [leadId]: [{id, name, color}] } }
// ============================================================================
router.get("/lead-assignments", async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "company_id required" });

    const result = await db.query(
      `SELECT la.lead_id, c.id, c.name, c.color
       FROM lead_assignments la
       JOIN crews c ON c.id = la.crew_id
       WHERE la.company_id = $1 AND la.crew_id IS NOT NULL
       GROUP BY la.lead_id, c.id, c.name, c.color
       ORDER BY la.lead_id, c.name`,
      [companyId]
    );

    const assignments = {};
    for (const row of result.rows) {
      if (!assignments[row.lead_id]) assignments[row.lead_id] = [];
      assignments[row.lead_id].push({ id: row.id, name: row.name, color: row.color });
    }

    res.json({ assignments });
  } catch (err) {
    console.error("Get lead assignments error:", err);
    res.status(500).json({ error: "Failed to fetch lead assignments" });
  }
});

// ============================================================================
// GET /api/crews/lead-individual-assignments — non-crew (individual) assignments per lead
// Returns { assignments: { [leadId]: [{userId, name}] } }
// ============================================================================
router.get("/lead-individual-assignments", async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "company_id required" });

    const result = await db.query(
      `SELECT la.lead_id, u.id AS user_id, u.name
       FROM lead_assignments la
       JOIN users u ON u.id = la.user_id AND u.deleted_at IS NULL
       WHERE la.company_id = $1 AND la.crew_id IS NULL AND la.assignment_role != 'salesperson'
       ORDER BY la.lead_id, u.name`,
      [companyId]
    );

    const assignments = {};
    for (const row of result.rows) {
      if (!assignments[row.lead_id]) assignments[row.lead_id] = [];
      assignments[row.lead_id].push({ userId: row.user_id, name: row.name });
    }

    res.json({ assignments });
  } catch (err) {
    console.error("Get individual assignments error:", err);
    res.status(500).json({ error: "Failed to fetch individual assignments" });
  }
});

// ============================================================================
// POST /api/crews — create a crew
// ============================================================================
router.post("/", requireRole("admin", "master"), async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "company_id required" });

    const { name, color = "#6366f1", ghl_calendar_id } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Crew name is required" });

    const result = await db.query(
      `INSERT INTO crews (company_id, name, color, ghl_calendar_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, company_id, name, color, is_active, ghl_calendar_id, created_at`,
      [companyId, name.trim(), color, ghl_calendar_id || null]
    );

    res.status(201).json({ crew: { ...result.rows[0], members: [] } });
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ error: "A crew with that name already exists" });
    console.error("Create crew error:", err);
    res.status(500).json({ error: "Failed to create crew" });
  }
});

// ============================================================================
// PUT /api/crews/:id — update name, color, or is_active
// ============================================================================
router.put("/:id", requireRole("admin", "master"), async (req, res) => {
  try {
    const crewId = parseInt(req.params.id, 10);
    const companyId = resolveCompanyId(req);

    const existing = await db.query(
      "SELECT company_id FROM crews WHERE id = $1",
      [crewId]
    );
    if (!existing.rows.length) return res.status(404).json({ error: "Crew not found" });
    if (req.user.role !== "master" && existing.rows[0].company_id !== companyId) {
      return res.status(403).json({ error: "Cannot update crews from other companies" });
    }

    const { name, color, is_active, ghl_calendar_id } = req.body;
    const updates = [];
    const values = [];
    let i = 1;

    if (name !== undefined) { updates.push(`name = $${i++}`); values.push(name.trim()); }
    if (color !== undefined) { updates.push(`color = $${i++}`); values.push(color); }
    if (is_active !== undefined) { updates.push(`is_active = $${i++}`); values.push(is_active); }
    if (ghl_calendar_id !== undefined) { updates.push(`ghl_calendar_id = $${i++}`); values.push(ghl_calendar_id || null); }

    if (!updates.length) return res.status(400).json({ error: "No fields to update" });

    values.push(crewId);
    const result = await db.query(
      `UPDATE crews SET ${updates.join(", ")} WHERE id = $${i}
       RETURNING id, company_id, name, color, is_active, ghl_calendar_id, created_at`,
      values
    );

    res.json({ crew: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ error: "A crew with that name already exists" });
    console.error("Update crew error:", err);
    res.status(500).json({ error: "Failed to update crew" });
  }
});

// ============================================================================
// DELETE /api/crews/:id — delete crew (members cascade, assignments set null)
// ============================================================================
router.delete("/:id", requireRole("admin", "master"), async (req, res) => {
  try {
    const crewId = parseInt(req.params.id, 10);
    const companyId = resolveCompanyId(req);

    const existing = await db.query("SELECT company_id FROM crews WHERE id = $1", [crewId]);
    if (!existing.rows.length) return res.status(404).json({ error: "Crew not found" });
    if (req.user.role !== "master" && existing.rows[0].company_id !== companyId) {
      return res.status(403).json({ error: "Cannot delete crews from other companies" });
    }

    await db.query("DELETE FROM crews WHERE id = $1", [crewId]);
    res.json({ message: "Crew deleted successfully" });
  } catch (err) {
    console.error("Delete crew error:", err);
    res.status(500).json({ error: "Failed to delete crew" });
  }
});

// ============================================================================
// POST /api/crews/:id/members — add a user to a crew
// ============================================================================
router.post("/:id/members", requireRole("admin", "master"), async (req, res) => {
  try {
    const crewId = parseInt(req.params.id, 10);
    const companyId = resolveCompanyId(req);
    const { user_id, is_lead = false } = req.body;

    if (!user_id) return res.status(400).json({ error: "user_id is required" });

    const crew = await db.query("SELECT company_id FROM crews WHERE id = $1", [crewId]);
    if (!crew.rows.length) return res.status(404).json({ error: "Crew not found" });
    if (req.user.role !== "master" && crew.rows[0].company_id !== companyId) {
      return res.status(403).json({ error: "Cannot modify crews from other companies" });
    }

    // Confirm user belongs to same company
    const userCheck = await db.query(
      "SELECT id, name, email, phone, is_active FROM users WHERE id = $1 AND deleted_at IS NULL",
      [user_id]
    );
    if (!userCheck.rows.length) return res.status(404).json({ error: "User not found" });

    await db.query(
      `INSERT INTO crew_members (crew_id, user_id, is_lead)
       VALUES ($1, $2, $3)
       ON CONFLICT (crew_id, user_id) DO UPDATE SET is_lead = EXCLUDED.is_lead`,
      [crewId, user_id, is_lead]
    );

    const u = userCheck.rows[0];
    res.status(201).json({
      member: { userId: u.id, name: u.name, email: u.email, phone: u.phone, isActive: u.is_active, isLead: is_lead },
    });
  } catch (err) {
    console.error("Add crew member error:", err);
    res.status(500).json({ error: "Failed to add crew member" });
  }
});

// ============================================================================
// PUT /api/crews/:id/members/:userId — toggle is_lead
// ============================================================================
router.put("/:id/members/:userId", requireRole("admin", "master"), async (req, res) => {
  try {
    const crewId = parseInt(req.params.id, 10);
    const userId = parseInt(req.params.userId, 10);
    const { is_lead } = req.body;

    await db.query(
      "UPDATE crew_members SET is_lead = $1 WHERE crew_id = $2 AND user_id = $3",
      [is_lead, crewId, userId]
    );

    res.json({ message: "Member updated" });
  } catch (err) {
    console.error("Update crew member error:", err);
    res.status(500).json({ error: "Failed to update crew member" });
  }
});

// ============================================================================
// DELETE /api/crews/:id/members/:userId — remove a user from a crew
// ============================================================================
router.delete("/:id/members/:userId", requireRole("admin", "master"), async (req, res) => {
  try {
    const crewId = parseInt(req.params.id, 10);
    const userId = parseInt(req.params.userId, 10);
    const companyId = resolveCompanyId(req);

    const crew = await db.query("SELECT company_id FROM crews WHERE id = $1", [crewId]);
    if (!crew.rows.length) return res.status(404).json({ error: "Crew not found" });
    if (req.user.role !== "master" && crew.rows[0].company_id !== companyId) {
      return res.status(403).json({ error: "Cannot modify crews from other companies" });
    }

    await db.query(
      "DELETE FROM crew_members WHERE crew_id = $1 AND user_id = $2",
      [crewId, userId]
    );

    res.json({ message: "Member removed" });
  } catch (err) {
    console.error("Remove crew member error:", err);
    res.status(500).json({ error: "Failed to remove crew member" });
  }
});

module.exports = router;
