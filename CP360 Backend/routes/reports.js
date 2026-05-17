const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const ghl = require('../controllers/ghlAPI');

// ─── helpers ────────────────────────────────────────────────────────────────

function companyIdFor(req) {
  return (req.user.role === 'master' && req.query.company_id)
    ? parseInt(req.query.company_id)
    : req.user.company_id;
}

function pct(num, den) {
  return den > 0 ? Math.round(num * 100 / den) : 0;
}

async function loadCompanyWithGHL(companyId) {
  const result = await pool.query(
    `SELECT id, name, ghl_api_key, ghl_location_id,
            ghl_appt_calendar, ghl_install_calendar,
            ghl_appt_assigned_user, ghl_install_assigned_user,
            ghl_sc_calendar, ghl_sc_assigned_user,
            ghl_appt_title_template, ghl_install_title_template,
            ghl_appt_description_template, ghl_install_description_template,
            timezone
     FROM companies WHERE id = $1 AND deleted_at IS NULL`,
    [companyId]
  );
  return result.rows[0] || null;
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
router.get('/automation-recovery', async (req, res) => {
  try {
    const companyId = companyIdFor(req);
    const { range, start, end } = req.query;

    const now = new Date();
    let from, to = now;
    if (start && end) {
      from = new Date(start);
      to = new Date(end); to.setHours(23, 59, 59, 999);
    } else if (range === 'ytd') {
      from = new Date(now.getFullYear(), 0, 1);
    } else if (range === '90') {
      from = new Date(now); from.setDate(from.getDate() - 90);
    } else {
      from = new Date(now); from.setDate(from.getDate() - 30);
    }

    // Check table exists before querying
    const tableRes = await pool.query(
      `SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='status_events') AS ok`
    );
    if (!tableRes.rows[0].ok) {
      console.warn('[automation-recovery] status_events table does not exist yet');
      return res.json({ success: true, metrics: { totalAppts: 0, totalSold: 0, recoveredAppts: 0, recoveredSales: 0, recoveredSalesRevenue: 0, apptRecoveryPct: 0, salesRecoveryPct: 0, avgDaysAppt: null, avgDaysSale: null }, recoveredAppts: [], recoveredSales: [] });
    }

    let totalAppts = 0, totalSold = 0, recoveredAppts = [], recoveredSales = [];

    try {
      const r = await pool.query(
        `SELECT COUNT(DISTINCT se.lead_id)::int AS total
         FROM status_events se
         JOIN leads l ON l.id = se.lead_id AND l.company_id = $1 AND l.deleted_at IS NULL
         WHERE se.to_status = 'appt_booked' AND se.created_at >= $2 AND se.created_at <= $3`,
        [companyId, from, to]
      );
      totalAppts = r.rows[0].total;
    } catch (e) { console.error('[automation-recovery] totalAppts:', e.message); }

    try {
      const r = await pool.query(
        `SELECT COUNT(DISTINCT se.lead_id)::int AS total
         FROM status_events se
         JOIN leads l ON l.id = se.lead_id AND l.company_id = $1 AND l.deleted_at IS NULL
         WHERE se.to_status = 'sold' AND se.created_at >= $2 AND se.created_at <= $3`,
        [companyId, from, to]
      );
      totalSold = r.rows[0].total;
    } catch (e) { console.error('[automation-recovery] totalSold:', e.message); }

    try {
      const r = await pool.query(
        `SELECT DISTINCT ON (se_appt.lead_id)
           l.full_name, l.lead_source,
           se_lead.created_at AS entered_lead_at,
           se_appt.created_at AS appt_set_at,
           GREATEST(0, ROUND(EXTRACT(EPOCH FROM (se_appt.created_at - se_lead.created_at)) / 86400))::int AS days_to_recovery
         FROM status_events se_appt
         JOIN leads l ON l.id = se_appt.lead_id AND l.company_id = $1 AND l.deleted_at IS NULL
         JOIN LATERAL (
           SELECT created_at FROM status_events
           WHERE lead_id = se_appt.lead_id AND to_status = 'lead' AND created_at < se_appt.created_at
           ORDER BY created_at DESC LIMIT 1
         ) se_lead ON true
         WHERE se_appt.to_status = 'appt_booked'
           AND se_appt.created_at >= $2 AND se_appt.created_at <= $3
         ORDER BY se_appt.lead_id, se_appt.created_at DESC`,
        [companyId, from, to]
      );
      recoveredAppts = r.rows;
    } catch (e) { console.error('[automation-recovery] recoveredAppts:', e.message); }

    try {
      const r = await pool.query(
        `SELECT DISTINCT ON (se_sold.lead_id)
           l.full_name, l.lead_source, l.contract_price,
           se_lost.created_at AS entered_lost_at,
           se_sold.created_at AS sold_at,
           GREATEST(0, ROUND(EXTRACT(EPOCH FROM (se_sold.created_at - se_lost.created_at)) / 86400))::int AS days_to_recovery
         FROM status_events se_sold
         JOIN leads l ON l.id = se_sold.lead_id AND l.company_id = $1 AND l.deleted_at IS NULL
         JOIN LATERAL (
           SELECT created_at FROM status_events
           WHERE lead_id = se_sold.lead_id AND to_status = 'lost' AND created_at < se_sold.created_at
           ORDER BY created_at DESC LIMIT 1
         ) se_lost ON true
         WHERE se_sold.to_status = 'sold'
           AND se_sold.created_at >= $2 AND se_sold.created_at <= $3
         ORDER BY se_sold.lead_id, se_sold.created_at DESC`,
        [companyId, from, to]
      );
      recoveredSales = r.rows;
    } catch (e) { console.error('[automation-recovery] recoveredSales:', e.message); }

    const recoveredSalesRevenue = recoveredSales.reduce((sum, r) => sum + (parseFloat(r.contract_price) || 0), 0);
    const avgDaysAppt = recoveredAppts.length ? Math.round(recoveredAppts.reduce((s, r) => s + r.days_to_recovery, 0) / recoveredAppts.length) : null;
    const avgDaysSale = recoveredSales.length ? Math.round(recoveredSales.reduce((s, r) => s + r.days_to_recovery, 0) / recoveredSales.length) : null;

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

// ─── GET /api/reports/orphan-contacts ────────────────────────────────────────
// Checks every active lead with a ghl_contact_id against GHL.
// Returns leads where GHL says the contact doesn't exist.
router.get('/orphan-contacts', async (req, res) => {
  try {
    if (req.user.role !== 'master') return res.status(403).json({ error: 'Master only' });

    const companyId = parseInt(req.query.company_id);
    if (!companyId) return res.status(400).json({ error: 'company_id required' });

    const company = await loadCompanyWithGHL(companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    if (!company.ghl_api_key) return res.status(400).json({ error: 'No GHL API key configured for this company' });

    const leadsResult = await pool.query(
      `SELECT id, name, phone, email, status, lead_source, ghl_contact_id, created_at
       FROM leads
       WHERE company_id = $1
         AND ghl_contact_id IS NOT NULL
         AND deleted_at IS NULL
         AND status != 'status_junk'
       ORDER BY created_at DESC
       LIMIT 100`,
      [companyId]
    );

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const orphans = [];
    for (const lead of leadsResult.rows) {
      try {
        await ghl.fetchGHLContact(lead.ghl_contact_id, company);
        // No throw = contact exists, not an orphan
      } catch (err) {
        if (err.status === 400 || err.status === 404) {
          orphans.push({
            id: lead.id,
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            status: lead.status,
            leadSource: lead.lead_source,
            createdAt: lead.created_at,
            ghlContactId: lead.ghl_contact_id,
          });
        }
        // 429 or other errors = skip, don't flag as orphan
      }
      await sleep(200); // stay under GHL rate limit
    }

    res.json({ success: true, checked: leadsResult.rows.length, orphans });
  } catch (error) {
    console.error('[GET /api/reports/orphan-contacts]', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/reports/orphan-resync ─────────────────────────────────────────
// Re-runs syncLeadToGHL for a single lead, recreating the GHL contact.
router.post('/orphan-resync', async (req, res) => {
  try {
    if (req.user.role !== 'master') return res.status(403).json({ error: 'Master only' });

    const { lead_id, company_id } = req.body;
    if (!lead_id || !company_id) return res.status(400).json({ error: 'lead_id and company_id required' });

    const company = await loadCompanyWithGHL(company_id);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const leadResult = await pool.query(
      `SELECT * FROM leads WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [lead_id, company_id]
    );
    if (leadResult.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });

    const contact = await ghl.syncLeadToGHL(leadResult.rows[0], company);
    res.json({ success: true, contactId: contact?.id || contact?.contact?.id || null });
  } catch (error) {
    console.error('[POST /api/reports/orphan-resync]', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
