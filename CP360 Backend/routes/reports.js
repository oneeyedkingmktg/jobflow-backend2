const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// ─── helpers ────────────────────────────────────────────────────────────────

function companyIdFor(req) {
  return (req.user.role === 'master' && req.query.company_id)
    ? parseInt(req.query.company_id)
    : req.user.company_id;
}

function pct(num, den) {
  return den > 0 ? Math.round(num * 100 / den) : 0;
}

// ─── GET /api/reports/definitions ───────────────────────────────────────────
// Returns the list of active report definitions (drives the reports list screen)
router.get('/definitions', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, key, name, description FROM report_definitions WHERE is_active = true ORDER BY id`
    );
    res.json({ success: true, reports: result.rows });
  } catch (error) {
    console.error('[GET /api/reports/definitions]', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/reports/activity ───────────────────────────────────────────────
// Counts of new leads, appts set, and jobs sold in the last 30 days.
router.get('/activity', async (req, res) => {
  try {
    const companyId = companyIdFor(req);
    const result = await pool.query(
      `SELECT
        CASE WHEN lead_source = 'estimator' THEN 'estimator' ELSE 'non_estimator' END AS category,
        COUNT(CASE WHEN created_at  >= NOW() - INTERVAL '30 days' THEN 1 END) AS new_leads,
        COUNT(CASE WHEN appt_set_at >= NOW() - INTERVAL '30 days' THEN 1 END) AS appts_set,
        COUNT(CASE WHEN sold_at     >= NOW() - INTERVAL '30 days' THEN 1 END) AS jobs_sold
      FROM leads
      WHERE company_id = $1
        AND status != 'status_junk'
        AND deleted_at IS NULL
      GROUP BY category
      ORDER BY category`,
      [companyId]
    );

    const metrics = { estimator: null, non_estimator: null };
    for (const row of result.rows) {
      metrics[row.category] = {
        newLeads:  parseInt(row.new_leads),
        apptsSet:  parseInt(row.appts_set),
        jobsSold:  parseInt(row.jobs_sold),
      };
    }
    res.json({ success: true, metrics });
  } catch (error) {
    console.error('[GET /api/reports/activity]', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/reports/conversions ────────────────────────────────────────────
// Cohort: leads created 30–60 days ago. Tracks how many got an appt and sold
// (at any point — the conversion date doesn't matter, only the lead entry date).
router.get('/conversions', async (req, res) => {
  try {
    const companyId = companyIdFor(req);
    const result = await pool.query(
      `SELECT
        CASE WHEN lead_source = 'estimator' THEN 'estimator' ELSE 'non_estimator' END AS category,
        COUNT(*) AS total_leads,
        COUNT(CASE WHEN appt_set_at IS NOT NULL THEN 1 END) AS leads_to_appt,
        COUNT(CASE WHEN sold_at IS NOT NULL THEN 1 END)     AS leads_to_sold,
        COUNT(CASE WHEN appt_set_at IS NOT NULL AND sold_at IS NOT NULL THEN 1 END) AS appt_to_sold
      FROM leads
      WHERE company_id = $1
        AND status != 'status_junk'
        AND deleted_at IS NULL
        AND created_at >= NOW() - INTERVAL '60 days'
        AND created_at <  NOW() - INTERVAL '30 days'
      GROUP BY category
      ORDER BY category`,
      [companyId]
    );

    const metrics = { estimator: null, non_estimator: null };
    for (const row of result.rows) {
      const total    = parseInt(row.total_leads);
      const toAppt   = parseInt(row.leads_to_appt);
      const toSold   = parseInt(row.leads_to_sold);
      const apptSold = parseInt(row.appt_to_sold);

      metrics[row.category] = {
        totalLeads:      total,
        leadsToAppt:     toAppt,
        leadsToSold:     toSold,
        apptToSold:      apptSold,
        leadToApptPct:   pct(toAppt, total),
        apptToSoldPct:   pct(apptSold, toAppt),
        leadToSoldPct:   pct(toSold, total),
      };
    }
    res.json({ success: true, metrics });
  } catch (error) {
    console.error('[GET /api/reports/conversions]', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
