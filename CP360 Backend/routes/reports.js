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

// ─── GET /api/reports/automation-recovery ────────────────────────────────────
// Cards + detail rows showing appointments and sales recovered by automation
// after manual follow-up stalled.
// Query params: range=30|90|ytd (default 30), OR start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/automation-recovery', async (req, res) => {
  try {
    const companyId = companyIdFor(req);
    const { range, start, end } = req.query;

    const now = new Date();
    let from;
    let to = now;

    if (start && end) {
      from = new Date(start);
      to = new Date(end);
      to.setHours(23, 59, 59, 999);
    } else if (range === 'ytd') {
      from = new Date(now.getFullYear(), 0, 1);
    } else if (range === '90') {
      from = new Date(now);
      from.setDate(from.getDate() - 90);
    } else {
      from = new Date(now);
      from.setDate(from.getDate() - 30);
    }

    // Total appointments set in range (distinct leads)
    const totalApptsRes = await pool.query(
      `SELECT COUNT(DISTINCT se.lead_id)::int AS total
       FROM status_events se
       JOIN leads l ON l.id = se.lead_id AND l.company_id = $1 AND l.deleted_at IS NULL
       WHERE se.to_status = 'appt_booked' AND se.created_at >= $2 AND se.created_at <= $3`,
      [companyId, from, to]
    );

    // Total sold in range (distinct leads)
    const totalSoldRes = await pool.query(
      `SELECT COUNT(DISTINCT se.lead_id)::int AS total
       FROM status_events se
       JOIN leads l ON l.id = se.lead_id AND l.company_id = $1 AND l.deleted_at IS NULL
       WHERE se.to_status = 'sold' AND se.created_at >= $2 AND se.created_at <= $3`,
      [companyId, from, to]
    );

    // Recovered appointments: lead entered 'lead' status, then appt_booked in range
    const recoveredApptsRes = await pool.query(
      `SELECT DISTINCT ON (se_appt.lead_id)
         l.full_name,
         l.lead_source,
         se_lead.created_at AS entered_lead_at,
         se_appt.created_at AS appt_set_at,
         GREATEST(0, ROUND(EXTRACT(EPOCH FROM (se_appt.created_at - se_lead.created_at)) / 86400))::int AS days_to_recovery
       FROM status_events se_appt
       JOIN leads l ON l.id = se_appt.lead_id AND l.company_id = $1 AND l.deleted_at IS NULL
       JOIN LATERAL (
         SELECT created_at FROM status_events
         WHERE lead_id = se_appt.lead_id
           AND to_status = 'lead'
           AND created_at < se_appt.created_at
         ORDER BY created_at DESC
         LIMIT 1
       ) se_lead ON true
       WHERE se_appt.to_status = 'appt_booked'
         AND se_appt.created_at >= $2 AND se_appt.created_at <= $3
       ORDER BY se_appt.lead_id, se_appt.created_at DESC`,
      [companyId, from, to]
    );

    // Recovered sales: lead entered 'lost' status, then sold in range
    const recoveredSalesRes = await pool.query(
      `SELECT DISTINCT ON (se_sold.lead_id)
         l.full_name,
         l.lead_source,
         l.contract_price,
         se_lost.created_at AS entered_lost_at,
         se_sold.created_at AS sold_at,
         GREATEST(0, ROUND(EXTRACT(EPOCH FROM (se_sold.created_at - se_lost.created_at)) / 86400))::int AS days_to_recovery
       FROM status_events se_sold
       JOIN leads l ON l.id = se_sold.lead_id AND l.company_id = $1 AND l.deleted_at IS NULL
       JOIN LATERAL (
         SELECT created_at FROM status_events
         WHERE lead_id = se_sold.lead_id
           AND to_status = 'lost'
           AND created_at < se_sold.created_at
         ORDER BY created_at DESC
         LIMIT 1
       ) se_lost ON true
       WHERE se_sold.to_status = 'sold'
         AND se_sold.created_at >= $2 AND se_sold.created_at <= $3
       ORDER BY se_sold.lead_id, se_sold.created_at DESC`,
      [companyId, from, to]
    );

    const recoveredAppts = recoveredApptsRes.rows;
    const recoveredSales = recoveredSalesRes.rows;

    const totalAppts = totalApptsRes.rows[0].total;
    const totalSold = totalSoldRes.rows[0].total;

    const recoveredSalesRevenue = recoveredSales.reduce(
      (sum, r) => sum + (parseFloat(r.contract_price) || 0), 0
    );
    const avgDaysAppt = recoveredAppts.length
      ? Math.round(recoveredAppts.reduce((s, r) => s + r.days_to_recovery, 0) / recoveredAppts.length)
      : null;
    const avgDaysSale = recoveredSales.length
      ? Math.round(recoveredSales.reduce((s, r) => s + r.days_to_recovery, 0) / recoveredSales.length)
      : null;

    res.json({
      success: true,
      metrics: {
        totalAppts,
        totalSold,
        recoveredAppts: recoveredAppts.length,
        recoveredSales: recoveredSales.length,
        recoveredSalesRevenue,
        apptRecoveryPct: pct(recoveredAppts.length, totalAppts),
        salesRecoveryPct: pct(recoveredSales.length, totalSold),
        avgDaysAppt,
        avgDaysSale,
      },
      recoveredAppts: recoveredAppts.map(r => ({
        fullName: r.full_name,
        leadSource: r.lead_source,
        enteredLeadAt: r.entered_lead_at,
        apptSetAt: r.appt_set_at,
        daysToRecovery: r.days_to_recovery,
      })),
      recoveredSales: recoveredSales.map(r => ({
        fullName: r.full_name,
        leadSource: r.lead_source,
        contractPrice: r.contract_price,
        enteredLostAt: r.entered_lost_at,
        soldAt: r.sold_at,
        daysToRecovery: r.days_to_recovery,
      })),
    });
  } catch (error) {
    console.error('[GET /api/reports/automation-recovery]', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
