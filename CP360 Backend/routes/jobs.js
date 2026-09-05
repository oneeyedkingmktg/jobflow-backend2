// ============================================================================
// File: routes/jobs.js
// Jobs CRUD — one lead can have many jobs (opportunities)
// ============================================================================

const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { authenticateToken } = require("../middleware/auth");

router.use(authenticateToken);

function resolveCompanyId(req) {
  if (req.user.role === "master") {
    const id = req.query.company_id || (req.body && req.body.company_id);
    if (id) return parseInt(id, 10);
  }
  return req.user.company_id;
}

const toCamel = (row) => ({
  id: row.id,
  companyId: row.company_id,
  leadId: row.lead_id,
  jobNumber: row.job_number,
  jobName: row.job_name,
  status: row.status,
  description: row.description,
  notes: row.notes,
  projectType: row.project_type,
  address: row.address,
  city: row.city,
  state: row.state,
  zip: row.zip,
  appointmentDate: row.appointment_date,
  appointmentTime: row.appointment_time,
  installDate: row.install_date,
  installEndDate: row.install_end_date,
  installTentative: row.install_tentative,
  contractPrice: row.contract_price,
  notSoldReason: row.not_sold_reason,
  assignedSalesmanId: row.assigned_salesman_id,
  primaryCrewId: row.primary_crew_id,
  salesmanName: row.salesman_name || null,
  crewName: row.crew_name || null,
  ghlOpportunityId: row.ghl_opportunity_id,
  createdByUserId: row.created_by_user_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// ============================================================================
// GET /api/jobs/pipeline — all jobs for the pipeline view (with contact info)
// Must be declared before /:id routes to avoid Express matching 'pipeline' as an id
// ============================================================================
router.get("/pipeline", async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "company_id required" });

    const result = await db.query(
      `SELECT j.*,
              l.full_name   AS contact_name,
              l.first_name  AS contact_first_name,
              l.last_name   AS contact_last_name,
              l.phone       AS contact_phone,
              l.city        AS contact_city,
              l.state       AS contact_state,
              l.email       AS contact_email,
              l.ghl_contact_id,
              u.name        AS salesman_name,
              c.name        AS crew_name
         FROM jobs j
         JOIN leads l ON l.id = j.lead_id
         LEFT JOIN users u ON u.id = j.appointment_salesman_id
         LEFT JOIN crews c ON c.id = j.primary_crew_id
        WHERE j.company_id = $1
          AND j.deleted_at IS NULL
          AND l.deleted_at IS NULL
        ORDER BY j.created_at DESC`,
      [companyId]
    );

    const jobs = result.rows.map((row) => ({
      id: row.id,
      companyId: row.company_id,
      leadId: row.lead_id,
      jobNumber: row.job_number,
      jobName: row.job_name,
      status: row.status,
      projectType: row.project_type,
      description: row.description,
      notes: row.notes,
      notSoldReason: row.not_sold_reason,
      contractPrice: row.contract_price,
      appointmentDate: row.appointment_date,
      appointmentTime: row.appointment_time,
      installDate: row.install_date,
      installEndDate: row.install_end_date,
      installTentative: row.install_tentative,
      installDurationDays: row.install_duration_days,
      soldAt: row.sold_at,
      createdAt: row.created_at,
      // Contact info from leads join
      contactName: row.contact_name || `${row.contact_first_name || ""} ${row.contact_last_name || ""}`.trim(),
      contactPhone: row.contact_phone,
      contactCity: row.contact_city,
      contactState: row.contact_state,
      contactEmail: row.contact_email,
      ghlContactId: row.ghl_contact_id,
      salesmanName: row.salesman_name,
      crewName: row.crew_name,
    }));

    res.json({ jobs });
  } catch (err) {
    console.error("GET /api/jobs/pipeline error:", err);
    res.status(500).json({ error: "Failed to load pipeline jobs" });
  }
});

// ============================================================================
// GET /api/jobs?lead_id=X — all jobs for a lead
// ============================================================================
router.get("/", async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "company_id required" });

    const { lead_id } = req.query;
    if (!lead_id) return res.status(400).json({ error: "lead_id required" });

    const result = await db.query(
      `SELECT j.*,
              u.name AS salesman_name,
              c.name AS crew_name
         FROM jobs j
         LEFT JOIN users u ON u.id = j.assigned_salesman_id
         LEFT JOIN crews c ON c.id = j.primary_crew_id
        WHERE j.lead_id = $1
          AND j.company_id = $2
          AND j.deleted_at IS NULL
        ORDER BY j.created_at ASC`,
      [lead_id, companyId]
    );

    res.json({ jobs: result.rows.map(toCamel) });
  } catch (err) {
    console.error("GET /api/jobs error:", err);
    res.status(500).json({ error: "Failed to load jobs" });
  }
});

// ============================================================================
// POST /api/jobs — create a new job
// ============================================================================
router.post("/", async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "company_id required" });

    const {
      lead_id,
      job_name,
      status = "pending",
      description,
      notes,
      project_type,
      address,
      city,
      state,
      zip,
      appointment_date,
      appointment_time,
      install_date,
      install_end_date,
      install_tentative,
      contract_price,
      assigned_salesman_id,
      primary_crew_id,
    } = req.body;

    if (!lead_id) return res.status(400).json({ error: "lead_id required" });
    if (!job_name || !job_name.trim()) return res.status(400).json({ error: "job_name required" });

    const job_number = `JOB-${Date.now()}`;

    const result = await db.query(
      `INSERT INTO jobs (
         company_id, lead_id, job_number, job_name,
         status, description, notes, project_type,
         address, city, state, zip,
         appointment_date, appointment_time,
         install_date, install_end_date, install_tentative,
         contract_price,
         assigned_salesman_id, primary_crew_id,
         created_by_user_id, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6, $7, $8,
         $9, $10, $11, $12,
         $13, $14,
         $15, $16, $17,
         $18,
         $19, $20,
         $21, NOW(), NOW()
       )
       RETURNING *`,
      [
        companyId, lead_id, job_number, job_name.trim(),
        status, description || null, notes || null, project_type || null,
        address || null, city || null, state || null, zip || null,
        appointment_date || null, appointment_time || null,
        install_date || null, install_end_date || null, install_tentative ?? false,
        contract_price || null,
        assigned_salesman_id || null, primary_crew_id || null,
        req.user.id,
      ]
    );

    res.status(201).json({ job: toCamel(result.rows[0]) });
  } catch (err) {
    console.error("POST /api/jobs error:", err);
    res.status(500).json({ error: "Failed to create job" });
  }
});

// ============================================================================
// PUT /api/jobs/:id — update a job
// ============================================================================
router.put("/:id", async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "company_id required" });

    const { id } = req.params;

    const {
      job_name,
      status,
      description,
      notes,
      project_type,
      address,
      city,
      state,
      zip,
      appointment_date,
      appointment_time,
      install_date,
      install_end_date,
      install_tentative,
      contract_price,
      not_sold_reason,
      assigned_salesman_id,
      primary_crew_id,
      ghl_opportunity_id,
    } = req.body;

    const result = await db.query(
      `UPDATE jobs SET
         job_name           = COALESCE($1, job_name),
         status             = COALESCE($2, status),
         description        = $3,
         notes              = $4,
         project_type       = $5,
         address            = $6,
         city               = $7,
         state              = $8,
         zip                = $9,
         appointment_date   = $10,
         appointment_time   = $11,
         install_date       = $12,
         install_end_date   = $13,
         install_tentative  = COALESCE($14, install_tentative),
         contract_price     = $15,
         not_sold_reason    = $16,
         assigned_salesman_id = $17,
         primary_crew_id    = $18,
         ghl_opportunity_id = COALESCE($19, ghl_opportunity_id),
         updated_at         = NOW()
       WHERE id = $20
         AND company_id = $21
         AND deleted_at IS NULL
       RETURNING *`,
      [
        job_name || null,
        status || null,
        description !== undefined ? description : null,
        notes !== undefined ? notes : null,
        project_type !== undefined ? project_type : null,
        address !== undefined ? address : null,
        city !== undefined ? city : null,
        state !== undefined ? state : null,
        zip !== undefined ? zip : null,
        appointment_date !== undefined ? appointment_date : null,
        appointment_time !== undefined ? appointment_time : null,
        install_date !== undefined ? install_date : null,
        install_end_date !== undefined ? install_end_date : null,
        install_tentative !== undefined ? install_tentative : null,
        contract_price !== undefined ? contract_price : null,
        not_sold_reason !== undefined ? not_sold_reason : null,
        assigned_salesman_id !== undefined ? assigned_salesman_id : null,
        primary_crew_id !== undefined ? primary_crew_id : null,
        ghl_opportunity_id || null,
        id,
        companyId,
      ]
    );

    if (!result.rows.length) return res.status(404).json({ error: "Job not found" });

    res.json({ job: toCamel(result.rows[0]) });
  } catch (err) {
    console.error("PUT /api/jobs/:id error:", err);
    res.status(500).json({ error: "Failed to update job" });
  }
});

// ============================================================================
// DELETE /api/jobs/:id — soft delete
// ============================================================================
router.delete("/:id", async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "company_id required" });

    const { id } = req.params;

    const result = await db.query(
      `UPDATE jobs
          SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1
          AND company_id = $2
          AND deleted_at IS NULL
        RETURNING id`,
      [id, companyId]
    );

    if (!result.rows.length) return res.status(404).json({ error: "Job not found" });

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/jobs/:id error:", err);
    res.status(500).json({ error: "Failed to delete job" });
  }
});

module.exports = router;
