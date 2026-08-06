// ============================================================================
// File: routes/timeTracking.js
// Employee time tracking — clock in/out per job, for job costing only
// Toggle: companies.time_tracking_enabled (master-only)
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

// Guard: block if time_tracking_enabled = false for the company (master bypasses)
async function requireTimeTracking(req, res, next) {
  if (req.user.role === "master") return next();
  try {
    const companyId = req.user.company_id;
    const result = await db.query(
      "SELECT time_tracking_enabled FROM companies WHERE id = $1",
      [companyId]
    );
    if (!result.rows.length || !result.rows[0].time_tracking_enabled) {
      return res.status(403).json({ error: "Time tracking is not enabled for this company" });
    }
    next();
  } catch (err) {
    console.error("Time tracking guard error:", err);
    res.status(500).json({ error: "Failed to check time tracking access" });
  }
}

router.use(requireTimeTracking);

// ============================================================================
// GET /api/time/jobs
// Smart job selector for clock-in screen.
// Returns: { jobs: [...], serviceCalls: [...] }
// - For user role: only jobs/SCs where user is assigned (direct or via crew)
// - For admin/master: all company jobs/SCs in window
// - Window: -7 days to +3 days from today based on appointment_date or install_date
// - ?search=<term>  → bypass window, search all open leads by name/address
// ============================================================================
router.get("/jobs", async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "company_id required" });

    const userId = req.user.id;
    const isFieldUser = req.user.role === "user";
    const search = req.query.search ? `%${req.query.search.trim()}%` : null;

    let jobs = [];
    let serviceCalls = [];

    if (search) {
      // Search all open leads — no date window, no assignment filter
      const result = await db.query(
        `SELECT l.id, l.name, l.address, l.city, l.state, l.phone,
                l.appointment_date, l.install_date, l.status
         FROM leads l
         WHERE l.company_id = $1
           AND l.deleted_at IS NULL
           AND l.status NOT IN ('lost')
           AND (l.name ILIKE $2 OR l.address ILIKE $2 OR l.phone ILIKE $2)
         ORDER BY l.name ASC
         LIMIT 30`,
        [companyId, search]
      );
      jobs = result.rows;
    } else {
      // Windowed query: -7 days to +3 days
      const assignmentFilter = isFieldUser
        ? `AND (
            EXISTS (SELECT 1 FROM lead_assignments la WHERE la.lead_id = l.id AND la.user_id = $2)
            OR EXISTS (
              SELECT 1 FROM lead_assignments la
              JOIN crew_members cm ON cm.crew_id = la.crew_id
              WHERE la.lead_id = l.id AND cm.user_id = $2
            )
           )`
        : "";

      const params = isFieldUser ? [companyId, userId] : [companyId];

      const jobResult = await db.query(
        `SELECT l.id, l.name, l.address, l.city, l.state,
                l.appointment_date, l.install_date, l.status
         FROM leads l
         WHERE l.company_id = $1
           AND l.deleted_at IS NULL
           AND l.status NOT IN ('lost')
           ${assignmentFilter}
           AND l.install_date BETWEEN CURRENT_DATE - 7 AND CURRENT_DATE + 3
         ORDER BY l.install_date ASC`,
        params
      );
      jobs = jobResult.rows;

      const scResult = await db.query(
        `SELECT sc.id, sc.lead_id, sc.scheduled_date, sc.scheduled_time, sc.sc_type, sc.title,
                l.name AS lead_name, l.address, l.city, l.state
         FROM service_calls sc
         JOIN leads l ON l.id = sc.lead_id
         WHERE l.company_id = $1
           AND l.deleted_at IS NULL
           AND sc.scheduled_date BETWEEN CURRENT_DATE - 7 AND CURRENT_DATE + 3
           ${isFieldUser
             ? `AND (
                 EXISTS (SELECT 1 FROM lead_assignments la WHERE la.lead_id = l.id AND la.user_id = $2)
                 OR EXISTS (
                   SELECT 1 FROM lead_assignments la
                   JOIN crew_members cm ON cm.crew_id = la.crew_id
                   WHERE la.lead_id = l.id AND cm.user_id = $2
                 )
               )`
             : ""}
         ORDER BY sc.scheduled_date ASC`,
        params
      );
      serviceCalls = scResult.rows;
    }

    res.json({ jobs, serviceCalls });
  } catch (err) {
    console.error("Get time jobs error:", err);
    res.status(500).json({ error: "Failed to fetch job list" });
  }
});

// ============================================================================
// POST /api/time/clock-in
// Body: { work_type: 'job'|'service_call'|'non_job', lead_id?, service_call_id?, notes? }
// work_type is required. lead_id is required for 'job' and 'service_call'.
// Blocks if the user already has an open entry.
// ============================================================================
router.post("/clock-in", async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "company_id required" });

    const userId = req.user.id;
    const { work_type, lead_id, service_call_id, notes } = req.body;

    const validTypes = ["job", "service_call", "non_job"];
    if (!work_type || !validTypes.includes(work_type)) {
      return res.status(400).json({ error: "work_type must be 'job', 'service_call', or 'non_job'" });
    }

    if (work_type !== "non_job" && !lead_id) {
      return res.status(400).json({ error: "lead_id is required for job and service_call entries" });
    }

    // Block double clock-in
    const openCheck = await db.query(
      "SELECT id FROM time_entries WHERE user_id = $1 AND company_id = $2 AND clock_out IS NULL",
      [userId, companyId]
    );
    if (openCheck.rows.length) {
      return res.status(409).json({
        error: "You are already clocked in. Clock out first.",
        open_entry_id: openCheck.rows[0].id,
      });
    }

    // Verify lead belongs to company
    if (lead_id) {
      const leadCheck = await db.query(
        "SELECT id FROM leads WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL",
        [lead_id, companyId]
      );
      if (!leadCheck.rows.length) {
        return res.status(404).json({ error: "Lead not found" });
      }
    }

    const result = await db.query(
      `INSERT INTO time_entries (company_id, user_id, lead_id, service_call_id, work_type, clock_in, notes)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6)
       RETURNING id, company_id, user_id, lead_id, service_call_id, work_type, clock_in, clock_out, duration_minutes, notes`,
      [companyId, userId, lead_id || null, service_call_id || null, work_type, notes || null]
    );

    // Attach lead name for convenience
    let entry = result.rows[0];
    if (entry.lead_id) {
      const leadRow = await db.query("SELECT name, address FROM leads WHERE id = $1", [entry.lead_id]);
      if (leadRow.rows.length) {
        entry = { ...entry, lead_name: leadRow.rows[0].name, lead_address: leadRow.rows[0].address };
      }
    }

    res.status(201).json({ entry });
  } catch (err) {
    console.error("Clock-in error:", err);
    res.status(500).json({ error: "Failed to clock in" });
  }
});

// ============================================================================
// POST /api/time/crew-clock-in
// Admin/master-initiated: clocks in a list of users for a specific lead.
// Body: { lead_id, user_ids: [1,2,3] }
// Skips users already clocked in (non-fatal).
// ============================================================================
router.post("/crew-clock-in", requireRole("admin", "master"), async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "company_id required" });

    const { lead_id, user_ids } = req.body;
    if (!lead_id || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ error: "lead_id and user_ids[] are required" });
    }

    // Verify lead belongs to company
    const leadCheck = await db.query(
      "SELECT id FROM leads WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL",
      [lead_id, companyId]
    );
    if (!leadCheck.rows.length) return res.status(404).json({ error: "Lead not found" });

    const results = [];
    for (const uid of user_ids) {
      const userId = parseInt(uid, 10);
      if (!userId) continue;
      // Skip if already clocked in
      const open = await db.query(
        "SELECT id FROM time_entries WHERE user_id = $1 AND company_id = $2 AND clock_out IS NULL",
        [userId, companyId]
      );
      if (open.rows.length) {
        results.push({ user_id: userId, status: "already_clocked_in" });
        continue;
      }
      await db.query(
        `INSERT INTO time_entries (company_id, user_id, lead_id, work_type, clock_in)
         VALUES ($1, $2, $3, 'job', NOW())`,
        [companyId, userId, lead_id]
      );
      results.push({ user_id: userId, status: "clocked_in" });
    }

    res.json({ results });
  } catch (err) {
    console.error("Crew clock-in error:", err);
    res.status(500).json({ error: "Failed to clock in crew" });
  }
});

// ============================================================================
// PUT /api/time/clock-out/:entryId
// Clocks out an open entry. Only the owning user (or admin/master) can clock out.
// Computes duration_minutes automatically.
// ============================================================================
router.put("/clock-out/:entryId", async (req, res) => {
  try {
    const entryId = parseInt(req.params.entryId, 10);
    const companyId = resolveCompanyId(req);
    const userId = req.user.id;
    const { notes } = req.body;

    // Verify the entry exists and belongs to this user (or caller is admin/master)
    const existing = await db.query(
      "SELECT id, user_id, company_id, clock_out FROM time_entries WHERE id = $1",
      [entryId]
    );
    if (!existing.rows.length) return res.status(404).json({ error: "Time entry not found" });

    const entry = existing.rows[0];
    if (entry.clock_out) return res.status(400).json({ error: "Entry already clocked out" });

    const isOwner = entry.user_id === userId;
    const canOverride = req.user.role === "admin" || req.user.role === "master";
    if (!isOwner && !canOverride) {
      return res.status(403).json({ error: "Cannot clock out another user's entry" });
    }
    if (req.user.role !== "master" && entry.company_id !== companyId) {
      return res.status(403).json({ error: "Entry belongs to another company" });
    }

    const updates = ["clock_out = NOW()", "duration_minutes = ROUND(EXTRACT(EPOCH FROM (NOW() - clock_in)) / 60)"];
    const values = [];
    let i = 1;

    if (notes !== undefined) {
      updates.push(`notes = $${i++}`);
      values.push(notes);
    }

    values.push(entryId);

    const result = await db.query(
      `UPDATE time_entries SET ${updates.join(", ")}
       WHERE id = $${i}
       RETURNING id, user_id, lead_id, service_call_id, work_type, clock_in, clock_out, duration_minutes, notes`,
      values
    );

    res.json({ entry: result.rows[0] });
  } catch (err) {
    console.error("Clock-out error:", err);
    res.status(500).json({ error: "Failed to clock out" });
  }
});

// ============================================================================
// GET /api/time/today
// Returns the current user's time entries for today, with lead name.
// ============================================================================
router.get("/today", async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "company_id required" });
    const userId = req.user.id;

    const result = await db.query(
      `SELECT te.id, te.lead_id, te.service_call_id, te.work_type,
              te.clock_in, te.clock_out, te.duration_minutes, te.notes,
              l.name AS lead_name, l.address AS lead_address
       FROM time_entries te
       LEFT JOIN leads l ON l.id = te.lead_id
       WHERE te.user_id = $1 AND te.company_id = $2
         AND (te.clock_in::date = CURRENT_DATE OR te.clock_out IS NULL)
       ORDER BY te.clock_in ASC`,
      [userId, companyId]
    );

    res.json({ entries: result.rows });
  } catch (err) {
    console.error("Get today error:", err);
    res.status(500).json({ error: "Failed to fetch today's entries" });
  }
});

// ============================================================================
// GET /api/time/week
// Returns the current user's entries for the current Mon–Sun week.
// Includes per-day totals for the summary view.
// ============================================================================
router.get("/week", async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "company_id required" });
    const userId = req.user.id;

    const result = await db.query(
      `SELECT te.id, te.lead_id, te.service_call_id, te.work_type,
              te.clock_in, te.clock_out, te.duration_minutes, te.notes,
              l.name AS lead_name
       FROM time_entries te
       LEFT JOIN leads l ON l.id = te.lead_id
       WHERE te.user_id = $1 AND te.company_id = $2
         AND te.clock_in >= date_trunc('week', CURRENT_DATE)
         AND te.clock_in < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
       ORDER BY te.clock_in ASC`,
      [userId, companyId]
    );

    // Compute total minutes for convenience
    const totalMinutes = result.rows.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);

    res.json({ entries: result.rows, total_minutes: totalMinutes });
  } catch (err) {
    console.error("Get week error:", err);
    res.status(500).json({ error: "Failed to fetch week entries" });
  }
});

// ============================================================================
// GET /api/time/lead/:leadId
// All time entries for a specific lead. Admin/master only.
// Includes user name and hourly_cost for labor cost calculation.
// ============================================================================
router.get("/lead/:leadId", requireRole("admin", "master"), async (req, res) => {
  try {
    const leadId = parseInt(req.params.leadId, 10);
    const companyId = resolveCompanyId(req);

    // Verify lead belongs to company
    const leadCheck = await db.query(
      "SELECT id, name FROM leads WHERE id = $1 AND (company_id = $2 OR $3 = 'master')",
      [leadId, companyId, req.user.role]
    );
    if (!leadCheck.rows.length) return res.status(404).json({ error: "Lead not found" });

    const result = await db.query(
      `SELECT te.id, te.user_id, te.work_type, te.clock_in, te.clock_out,
              te.duration_minutes, te.notes, te.service_call_id,
              u.name AS user_name, u.hourly_cost
       FROM time_entries te
       JOIN users u ON u.id = te.user_id
       WHERE te.lead_id = $1
       ORDER BY te.clock_in ASC`,
      [leadId]
    );

    // Compute total labor cost
    const totalMinutes = result.rows.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
    const totalLaborCost = result.rows.reduce((sum, e) => {
      const hours = (e.duration_minutes || 0) / 60;
      return sum + hours * (parseFloat(e.hourly_cost) || 0);
    }, 0);

    res.json({
      entries: result.rows,
      total_minutes: totalMinutes,
      total_labor_cost: parseFloat(totalLaborCost.toFixed(2)),
    });
  } catch (err) {
    console.error("Get lead time entries error:", err);
    res.status(500).json({ error: "Failed to fetch lead time entries" });
  }
});

// ============================================================================
// GET /api/time/company
// All time entries for the company, filterable by user/date range. Admin/master only.
// ?user_id=N&start=YYYY-MM-DD&end=YYYY-MM-DD
// ============================================================================
router.get("/company", requireRole("admin", "master"), async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "company_id required" });

    const filterUserId = req.query.user_id ? parseInt(req.query.user_id, 10) : null;
    const startDate = req.query.start || null;
    const endDate = req.query.end || null;

    const conditions = ["te.company_id = $1"];
    const params = [companyId];
    let i = 2;

    if (filterUserId) {
      conditions.push(`te.user_id = $${i++}`);
      params.push(filterUserId);
    }
    if (startDate) {
      conditions.push(`te.clock_in::date >= $${i++}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`te.clock_in::date <= $${i++}`);
      params.push(endDate);
    }

    const result = await db.query(
      `SELECT te.id, te.user_id, te.lead_id, te.service_call_id, te.work_type,
              te.clock_in, te.clock_out, te.duration_minutes, te.notes,
              u.name AS user_name, u.hourly_cost,
              l.name AS lead_name
       FROM time_entries te
       JOIN users u ON u.id = te.user_id
       LEFT JOIN leads l ON l.id = te.lead_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY te.clock_in DESC
       LIMIT 1000`,
      params
    );

    const totalMinutes = result.rows.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);

    res.json({ entries: result.rows, total_minutes: totalMinutes });
  } catch (err) {
    console.error("Get company time entries error:", err);
    res.status(500).json({ error: "Failed to fetch company time entries" });
  }
});

// ============================================================================
// GET /api/time/active
// All currently clocked-in users for the company. Admin/master only.
// Used by admin roster view and crew clock-in modal.
// ============================================================================
router.get("/active", requireRole("admin", "master"), async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "company_id required" });

    const result = await db.query(
      `SELECT te.id, te.user_id, te.lead_id, te.service_call_id, te.work_type, te.clock_in, te.notes,
              u.name AS user_name,
              l.name AS lead_name, l.address AS lead_address
       FROM time_entries te
       JOIN users u ON u.id = te.user_id
       LEFT JOIN leads l ON l.id = te.lead_id
       WHERE te.company_id = $1
         AND te.clock_out IS NULL
       ORDER BY te.clock_in ASC`,
      [companyId]
    );

    res.json({ active: result.rows });
  } catch (err) {
    console.error("Get active entries error:", err);
    res.status(500).json({ error: "Failed to fetch active entries" });
  }
});

// ============================================================================
// POST /api/time/crew-clock-out
// Admin/master-initiated: clocks out a list of users by user_id.
// Body: { user_ids: [1,2,3] }
// Skips users with no open entry (non-fatal).
// ============================================================================
router.post("/crew-clock-out", requireRole("admin", "master"), async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "company_id required" });

    const { user_ids } = req.body;
    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ error: "user_ids[] is required" });
    }

    const results = [];
    for (const uid of user_ids) {
      const userId = parseInt(uid, 10);
      if (!userId) continue;
      const open = await db.query(
        "SELECT id FROM time_entries WHERE user_id = $1 AND company_id = $2 AND clock_out IS NULL",
        [userId, companyId]
      );
      if (!open.rows.length) {
        results.push({ user_id: userId, status: "not_clocked_in" });
        continue;
      }
      const entryId = open.rows[0].id;
      await db.query(
        `UPDATE time_entries
         SET clock_out = NOW(), duration_minutes = ROUND(EXTRACT(EPOCH FROM (NOW() - clock_in)) / 60)
         WHERE id = $1`,
        [entryId]
      );
      results.push({ user_id: userId, status: "clocked_out", entry_id: entryId });
    }

    res.json({ results });
  } catch (err) {
    console.error("Crew clock-out error:", err);
    res.status(500).json({ error: "Failed to clock out crew" });
  }
});

module.exports = router;
