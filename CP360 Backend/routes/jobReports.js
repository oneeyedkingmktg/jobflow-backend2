// ============================================================================
// File: routes/jobReports.js
// Job Costing — materials library, per-job material entries, labor overrides
// Admin/master only
// ============================================================================

const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { requireRole } = require("../middleware/auth");

// All job report routes require admin or master
router.use(requireRole("admin", "master"));

function resolveCompanyId(req) {
  if (req.user.role === "master") {
    const id = req.query.company_id || (req.body && req.body.company_id);
    if (id) return parseInt(id, 10);
  }
  return req.user.company_id;
}

// ============================================================================
// MATERIAL LIBRARY — categories
// Routes must come before /:leadId/* to avoid Express treating 'library' as a leadId
// ============================================================================

// GET /api/job-reports/library — categories with items
router.get("/library", async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "company_id required" });

    const cats = await db.query(
      `SELECT id, name, sort_order FROM material_categories
       WHERE company_id = $1 AND is_active = true ORDER BY sort_order ASC, name ASC`,
      [companyId]
    );
    const items = await db.query(
      `SELECT id, category_id, name, unit, default_cost FROM material_items
       WHERE company_id = $1 AND is_active = true ORDER BY name ASC`,
      [companyId]
    );

    const categories = cats.rows.map((c) => ({
      ...c,
      items: items.rows.filter((i) => i.category_id === c.id),
    }));

    res.json({ categories });
  } catch (err) {
    console.error("Get material library error:", err);
    res.status(500).json({ error: "Failed to fetch material library" });
  }
});

// POST /api/job-reports/library/categories
router.post("/library/categories", async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    const { name, sort_order = 0 } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });

    const result = await db.query(
      `INSERT INTO material_categories (company_id, name, sort_order) VALUES ($1, $2, $3) RETURNING *`,
      [companyId, name.trim(), sort_order]
    );
    res.status(201).json({ category: result.rows[0] });
  } catch (err) {
    console.error("Create category error:", err);
    res.status(500).json({ error: "Failed to create category" });
  }
});

// PUT /api/job-reports/library/categories/:id
router.put("/library/categories/:id", async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    const { name, sort_order } = req.body;
    const result = await db.query(
      `UPDATE material_categories
       SET name = COALESCE($1, name), sort_order = COALESCE($2, sort_order)
       WHERE id = $3 AND company_id = $4 RETURNING *`,
      [name || null, sort_order !== undefined ? sort_order : null, parseInt(req.params.id), companyId]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Category not found" });
    res.json({ category: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to update category" });
  }
});

// DELETE /api/job-reports/library/categories/:id
router.delete("/library/categories/:id", async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    await db.query(
      `UPDATE material_categories SET is_active = false WHERE id = $1 AND company_id = $2`,
      [parseInt(req.params.id), companyId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete category" });
  }
});

// POST /api/job-reports/library/items
router.post("/library/items", async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    const { category_id, name, unit, default_cost = 0 } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });

    const result = await db.query(
      `INSERT INTO material_items (company_id, category_id, name, unit, default_cost)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [companyId, category_id || null, name.trim(), unit || null, default_cost]
    );
    res.status(201).json({ item: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to create item" });
  }
});

// PUT /api/job-reports/library/items/:id
router.put("/library/items/:id", async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    const { name, unit, default_cost, category_id } = req.body;
    const result = await db.query(
      `UPDATE material_items
       SET name = COALESCE($1, name),
           unit = COALESCE($2, unit),
           default_cost = COALESCE($3, default_cost),
           category_id = COALESCE($4, category_id)
       WHERE id = $5 AND company_id = $6 RETURNING *`,
      [name || null, unit || null, default_cost !== undefined ? default_cost : null,
       category_id || null, parseInt(req.params.id), companyId]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Item not found" });
    res.json({ item: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to update item" });
  }
});

// DELETE /api/job-reports/library/items/:id
router.delete("/library/items/:id", async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    await db.query(
      `UPDATE material_items SET is_active = false WHERE id = $1 AND company_id = $2`,
      [parseInt(req.params.id), companyId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete item" });
  }
});

// ============================================================================
// PER-JOB: SUMMARY (labor + materials + profit calc)
// ============================================================================

router.get("/:leadId/summary", async (req, res) => {
  try {
    const leadId = parseInt(req.params.leadId, 10);
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "company_id required" });

    const leadRow = await db.query(
      `SELECT id, name, project_type, contract_price FROM leads
       WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [leadId, companyId]
    );
    if (!leadRow.rows.length) return res.status(404).json({ error: "Lead not found" });
    const lead = leadRow.rows[0];

    // Labor: aggregate completed entries by employee, apply per-job wage override
    const laborRows = await db.query(
      `SELECT
         te.user_id,
         u.name AS user_name,
         u.hourly_cost AS default_wage,
         COALESCE(o.wage_override, u.hourly_cost, 0) AS effective_wage,
         (o.wage_override IS NOT NULL) AS has_override,
         SUM(te.duration_minutes) AS total_minutes
       FROM time_entries te
       JOIN users u ON u.id = te.user_id
       LEFT JOIN job_cost_labor_overrides o
         ON o.lead_id = te.lead_id AND o.user_id = te.user_id
       WHERE te.lead_id = $1 AND te.clock_out IS NOT NULL
       GROUP BY te.user_id, u.name, u.hourly_cost, o.wage_override
       ORDER BY u.name ASC`,
      [leadId]
    );

    let totalMinutes = 0;
    let totalLaborCost = 0;
    for (const row of laborRows.rows) {
      const mins = parseInt(row.total_minutes, 10) || 0;
      const wage = parseFloat(row.effective_wage) || 0;
      totalMinutes += mins;
      totalLaborCost += (mins / 60) * wage;
    }

    // Materials total
    const matsRow = await db.query(
      `SELECT COALESCE(SUM(total), 0) AS total_cost FROM job_cost_entries WHERE lead_id = $1 AND company_id = $2`,
      [leadId, companyId]
    );
    const materialsCost = parseFloat(matsRow.rows[0].total_cost) || 0;

    const contractPrice = parseFloat(lead.contract_price) || 0;
    const totalJobCost = totalLaborCost + materialsCost;
    const grossProfit = contractPrice - totalJobCost;
    const marginPct = contractPrice > 0 ? (grossProfit / contractPrice) * 100 : 0;

    res.json({
      lead: {
        id: lead.id,
        name: lead.name,
        project_type: lead.project_type,
        contract_price: contractPrice,
      },
      labor: {
        employees: laborRows.rows.map((r) => ({
          user_id: r.user_id,
          user_name: r.user_name,
          total_minutes: parseInt(r.total_minutes, 10) || 0,
          default_wage: parseFloat(r.default_wage) || 0,
          effective_wage: parseFloat(r.effective_wage) || 0,
          has_override: r.has_override,
        })),
        total_minutes: totalMinutes,
        total_cost: parseFloat(totalLaborCost.toFixed(2)),
      },
      materials: {
        total_cost: parseFloat(materialsCost.toFixed(2)),
      },
      summary: {
        total_job_cost: parseFloat(totalJobCost.toFixed(2)),
        contract_price: contractPrice,
        gross_profit: parseFloat(grossProfit.toFixed(2)),
        margin_pct: parseFloat(marginPct.toFixed(1)),
      },
    });
  } catch (err) {
    console.error("Job reports summary error:", err);
    res.status(500).json({ error: "Failed to fetch job report" });
  }
});

// ============================================================================
// PER-JOB: LABOR WAGE OVERRIDE
// ============================================================================

router.put("/:leadId/labor-override", async (req, res) => {
  try {
    const leadId = parseInt(req.params.leadId, 10);
    const companyId = resolveCompanyId(req);
    const { user_id, wage } = req.body;

    if (!user_id || wage === undefined || wage === null) {
      return res.status(400).json({ error: "user_id and wage required" });
    }

    await db.query(
      `INSERT INTO job_cost_labor_overrides (lead_id, company_id, user_id, wage_override, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (lead_id, user_id) DO UPDATE SET wage_override = $4, updated_at = NOW()`,
      [leadId, companyId, parseInt(user_id), parseFloat(wage)]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("Labor override error:", err);
    res.status(500).json({ error: "Failed to save wage override" });
  }
});

// ============================================================================
// PER-JOB: MATERIAL ENTRIES
// ============================================================================

router.get("/:leadId/materials", async (req, res) => {
  try {
    const leadId = parseInt(req.params.leadId, 10);
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "company_id required" });

    const result = await db.query(
      `SELECT id, material_item_id, name, qty, unit, unit_cost, total, notes, created_at
       FROM job_cost_entries
       WHERE lead_id = $1 AND company_id = $2
       ORDER BY created_at ASC`,
      [leadId, companyId]
    );
    res.json({ materials: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch materials" });
  }
});

router.post("/:leadId/materials", async (req, res) => {
  try {
    const leadId = parseInt(req.params.leadId, 10);
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "company_id required" });

    const { material_item_id, name, qty = 1, unit, unit_cost = 0, notes, save_to_library, category_id } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });

    const parsedQty = parseFloat(qty) || 1;
    const parsedCost = parseFloat(unit_cost) || 0;
    const total = parsedQty * parsedCost;

    const result = await db.query(
      `INSERT INTO job_cost_entries
         (lead_id, company_id, material_item_id, name, qty, unit, unit_cost, total, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [leadId, companyId, material_item_id || null, name.trim(),
       parsedQty, unit || null, parsedCost, total, notes || null, req.user.id]
    );

    // Optionally save custom item to library
    if (save_to_library && !material_item_id) {
      db.query(
        `INSERT INTO material_items (company_id, category_id, name, unit, default_cost)
         VALUES ($1, $2, $3, $4, $5)`,
        [companyId, category_id || null, name.trim(), unit || null, parsedCost]
      ).catch(() => {});
    }

    res.status(201).json({ material: result.rows[0] });
  } catch (err) {
    console.error("Add material error:", err);
    res.status(500).json({ error: "Failed to add material" });
  }
});

router.put("/:leadId/materials/:itemId", async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    const itemId = parseInt(req.params.itemId, 10);
    const { name, qty, unit, unit_cost, notes } = req.body;

    const current = await db.query(
      `SELECT qty, unit_cost FROM job_cost_entries WHERE id = $1 AND company_id = $2`,
      [itemId, companyId]
    );
    if (!current.rows.length) return res.status(404).json({ error: "Material not found" });

    const finalQty = qty !== undefined ? parseFloat(qty) : parseFloat(current.rows[0].qty);
    const finalCost = unit_cost !== undefined ? parseFloat(unit_cost) : parseFloat(current.rows[0].unit_cost);
    const newTotal = finalQty * finalCost;

    const result = await db.query(
      `UPDATE job_cost_entries
       SET name = COALESCE($1, name),
           qty = $2,
           unit = COALESCE($3, unit),
           unit_cost = $4,
           total = $5,
           notes = COALESCE($6, notes)
       WHERE id = $7 AND company_id = $8 RETURNING *`,
      [name || null, finalQty, unit || null, finalCost, newTotal, notes || null, itemId, companyId]
    );
    res.json({ material: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to update material" });
  }
});

router.delete("/:leadId/materials/:itemId", async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    await db.query(
      `DELETE FROM job_cost_entries WHERE id = $1 AND company_id = $2`,
      [parseInt(req.params.itemId, 10), companyId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete material" });
  }
});

module.exports = router;
