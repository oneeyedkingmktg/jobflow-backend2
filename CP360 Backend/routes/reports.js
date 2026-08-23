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
// Section 1 — Appointments: total set + recovered (had prior lead status).
// Section 2 — Lead Sales: sold with prior lead, no not_sold before (priority 2).
// Section 3 — Not Sold Recovery: sold with prior not_sold/lost (priority 1).
// A sold job counts in only one bucket. All detail rows include lead id for linking.
router.get('/automation-recovery', async (req, res) => {
  try {
    const companyId = companyIdFor(req);
    const { range } = req.query;

    const now = new Date();
    let from;
    if (range === 'all') {
      from = new Date('2000-01-01');
    } else if (range === 'ytd') {
      from = new Date(now.getFullYear(), 0, 1);
    } else {
      const days = parseInt(range) || 30;
      from = new Date(now); from.setDate(from.getDate() - days);
    }
    const to = now;

    const [totalApptsRes, recoveredApptsRes, notSoldRes, leadSalesRes, notSoldDenomRes] = await Promise.all([

      // 1. Total appointments set in window
      pool.query(
        `SELECT COUNT(DISTINCT se.lead_id)::int AS total
         FROM status_events se
         JOIN leads l ON l.id = se.lead_id AND l.company_id = $1 AND l.deleted_at IS NULL AND l.status != 'status_junk'
         WHERE se.to_status = 'appt_booked' AND se.created_at >= $2 AND se.created_at <= $3`,
        [companyId, from, to]
      ),

      // 2. Recovered appointments: appt_booked in window with prior 'lead' event
      pool.query(
        `SELECT DISTINCT ON (se_appt.lead_id)
           l.id, l.full_name,
           se_lead.last_lead_at AS lead_date,
           se_appt.created_at  AS appt_date,
           GREATEST(0, ROUND(EXTRACT(EPOCH FROM (se_appt.created_at - se_lead.last_lead_at)) / 86400))::int AS days_to_recovery
         FROM status_events se_appt
         JOIN leads l ON l.id = se_appt.lead_id AND l.company_id = $1 AND l.deleted_at IS NULL AND l.status != 'status_junk'
         JOIN LATERAL (
           SELECT MAX(created_at) AS last_lead_at
           FROM status_events
           WHERE lead_id = se_appt.lead_id AND to_status = 'lead' AND created_at < se_appt.created_at
         ) se_lead ON se_lead.last_lead_at IS NOT NULL
         WHERE se_appt.to_status = 'appt_booked' AND se_appt.created_at >= $2 AND se_appt.created_at <= $3
         ORDER BY se_appt.lead_id, se_appt.created_at DESC`,
        [companyId, from, to]
      ),

      // 3. Not Sold Recovery (priority 1): sold in window with prior not_sold/lost
      pool.query(
        `SELECT DISTINCT ON (se_sold.lead_id)
           l.id, l.full_name, l.contract_price,
           se_lost.last_lost_at AS not_sold_date,
           se_sold.created_at   AS sold_date,
           GREATEST(0, ROUND(EXTRACT(EPOCH FROM (se_sold.created_at - se_lost.last_lost_at)) / 86400))::int AS days_to_recovery
         FROM status_events se_sold
         JOIN leads l ON l.id = se_sold.lead_id AND l.company_id = $1 AND l.deleted_at IS NULL AND l.status != 'status_junk'
         JOIN LATERAL (
           SELECT MAX(created_at) AS last_lost_at
           FROM status_events
           WHERE lead_id = se_sold.lead_id AND to_status IN ('lost', 'not_sold') AND created_at < se_sold.created_at
         ) se_lost ON se_lost.last_lost_at IS NOT NULL
         WHERE se_sold.to_status = 'sold' AND se_sold.created_at >= $2 AND se_sold.created_at <= $3
         ORDER BY se_sold.lead_id, se_sold.created_at DESC`,
        [companyId, from, to]
      ),

      // 4. Lead Sales (priority 2): sold in window with prior lead, NOT prior not_sold/lost
      pool.query(
        `SELECT DISTINCT ON (se_sold.lead_id)
           l.id, l.full_name, l.contract_price,
           se_lead.last_lead_at AS lead_date,
           se_sold.created_at   AS sold_date
         FROM status_events se_sold
         JOIN leads l ON l.id = se_sold.lead_id AND l.company_id = $1 AND l.deleted_at IS NULL AND l.status != 'status_junk'
         JOIN LATERAL (
           SELECT MAX(created_at) AS last_lead_at
           FROM status_events
           WHERE lead_id = se_sold.lead_id AND to_status = 'lead' AND created_at < se_sold.created_at
         ) se_lead ON se_lead.last_lead_at IS NOT NULL
         WHERE se_sold.to_status = 'sold' AND se_sold.created_at >= $2 AND se_sold.created_at <= $3
           AND NOT EXISTS (
             SELECT 1 FROM status_events
             WHERE lead_id = se_sold.lead_id AND to_status IN ('lost', 'not_sold') AND created_at < se_sold.created_at
           )
         ORDER BY se_sold.lead_id, se_sold.created_at DESC`,
        [companyId, from, to]
      ),

      // 5. Not Sold denominator: leads that entered not_sold/lost in window (for recovery rate)
      pool.query(
        `SELECT COUNT(DISTINCT se.lead_id)::int AS total
         FROM status_events se
         JOIN leads l ON l.id = se.lead_id AND l.company_id = $1 AND l.deleted_at IS NULL AND l.status != 'status_junk'
         WHERE se.to_status IN ('lost', 'not_sold') AND se.created_at >= $2 AND se.created_at <= $3`,
        [companyId, from, to]
      ),
    ]);

    const recoveredAppts  = recoveredApptsRes.rows;
    const notSoldRows     = notSoldRes.rows;
    const leadSalesRows   = leadSalesRes.rows;
    const totalAppts      = totalApptsRes.rows[0].total;
    const notSoldDenom    = notSoldDenomRes.rows[0].total;

    const avgDaysAppt    = recoveredAppts.length ? Math.round(recoveredAppts.reduce((s, r) => s + r.days_to_recovery, 0) / recoveredAppts.length) : null;
    const avgDaysNotSold = notSoldRows.length    ? Math.round(notSoldRows.reduce((s, r) => s + r.days_to_recovery, 0) / notSoldRows.length) : null;

    res.json({
      success: true,
      metrics: {
        totalAppts,
        recoveredAppts:       recoveredAppts.length,
        apptRecoveryPct:      pct(recoveredAppts.length, totalAppts),
        avgDaysAppt,
        leadSalesCount:       leadSalesRows.length,
        leadSalesRevenue:     leadSalesRows.reduce((s, r) => s + (parseFloat(r.contract_price) || 0), 0),
        notSoldCount:         notSoldRows.length,
        notSoldRevenue:       notSoldRows.reduce((s, r) => s + (parseFloat(r.contract_price) || 0), 0),
        notSoldRecoveryPct:   pct(notSoldRows.length, notSoldDenom),
        avgDaysNotSold,
      },
      recoveredAppts: recoveredAppts.map(r => ({
        id: r.id, fullName: r.full_name,
        leadDate: r.lead_date, apptDate: r.appt_date, daysToRecovery: r.days_to_recovery,
      })),
      leadSales: leadSalesRows.map(r => ({
        id: r.id, fullName: r.full_name, contractPrice: r.contract_price,
        leadDate: r.lead_date, soldDate: r.sold_date,
      })),
      notSoldRecovery: notSoldRows.map(r => ({
        id: r.id, fullName: r.full_name, contractPrice: r.contract_price,
        notSoldDate: r.not_sold_date, soldDate: r.sold_date, daysToRecovery: r.days_to_recovery,
      })),
    });
  } catch (error) {
    console.error('[GET /api/reports/automation-recovery]', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/reports/conversions-by-source ──────────────────────────────────
router.get('/conversions-by-source', async (req, res) => {
  try {
    const companyId = companyIdFor(req);
    const { range, start, end } = req.query;

    const now = new Date();
    let from, to = now;
    if (start && end) {
      from = new Date(start);
      to = new Date(end); to.setHours(23, 59, 59, 999);
    } else {
      const days = parseInt(range) || 90;
      from = new Date(now); from.setDate(from.getDate() - days);
    }

    const [rowsRes, totalsRes] = await Promise.all([
      pool.query(
        `SELECT
          COALESCE(utm_source, 'organic') AS source,
          COUNT(*)::int AS total_leads,
          COUNT(CASE WHEN appt_set_at IS NOT NULL THEN 1 END)::int AS appts_set,
          COUNT(CASE WHEN sold_at IS NOT NULL THEN 1 END)::int AS sold,
          COUNT(CASE WHEN appt_set_at IS NOT NULL AND sold_at IS NOT NULL THEN 1 END)::int AS appt_and_sold,
          ROUND(AVG(CASE WHEN appt_set_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (appt_set_at - created_at)) / 86400 END)::numeric, 1) AS avg_days_to_appt,
          ROUND(AVG(CASE WHEN sold_at IS NOT NULL AND appt_set_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (sold_at - appt_set_at)) / 86400 END)::numeric, 1) AS avg_days_appt_to_sold
        FROM leads
        WHERE company_id = $1
          AND status != 'status_junk'
          AND deleted_at IS NULL
          AND created_at >= $2 AND created_at <= $3
        GROUP BY COALESCE(utm_source, 'organic')
        ORDER BY total_leads DESC`,
        [companyId, from, to]
      ),
      pool.query(
        `SELECT
          COUNT(*)::int AS total_leads,
          COUNT(CASE WHEN appt_set_at IS NOT NULL THEN 1 END)::int AS appts_set,
          COUNT(CASE WHEN sold_at IS NOT NULL THEN 1 END)::int AS sold,
          COUNT(CASE WHEN appt_set_at IS NOT NULL AND sold_at IS NOT NULL THEN 1 END)::int AS appt_and_sold,
          ROUND(AVG(CASE WHEN appt_set_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (appt_set_at - created_at)) / 86400 END)::numeric, 1) AS avg_days_to_appt,
          ROUND(AVG(CASE WHEN sold_at IS NOT NULL AND appt_set_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (sold_at - appt_set_at)) / 86400 END)::numeric, 1) AS avg_days_appt_to_sold
        FROM leads
        WHERE company_id = $1
          AND status != 'status_junk'
          AND deleted_at IS NULL
          AND created_at >= $2 AND created_at <= $3`,
        [companyId, from, to]
      ),
    ]);

    const mapRow = (r) => ({
      source: r.source,
      totalLeads: r.total_leads,
      apptsSet: r.appts_set,
      apptRate: pct(r.appts_set, r.total_leads),
      avgDaysToAppt: r.avg_days_to_appt != null ? parseFloat(r.avg_days_to_appt) : null,
      sold: r.sold,
      leadToSoldPct: pct(r.sold, r.total_leads),
      apptToSoldPct: pct(r.appt_and_sold, r.appts_set),
      avgDaysApptToSold: r.avg_days_appt_to_sold != null ? parseFloat(r.avg_days_appt_to_sold) : null,
    });

    const t = totalsRes.rows[0];
    const totals = {
      totalLeads: t.total_leads,
      apptsSet: t.appts_set,
      apptRate: pct(t.appts_set, t.total_leads),
      avgDaysToAppt: t.avg_days_to_appt != null ? parseFloat(t.avg_days_to_appt) : null,
      sold: t.sold,
      leadToSoldPct: pct(t.sold, t.total_leads),
      apptToSoldPct: pct(t.appt_and_sold, t.appts_set),
      avgDaysApptToSold: t.avg_days_appt_to_sold != null ? parseFloat(t.avg_days_appt_to_sold) : null,
    };

    res.json({ success: true, rows: rowsRes.rows.map(mapRow), totals });
  } catch (error) {
    console.error('[GET /api/reports/conversions-by-source]', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/reports/cost-per-sale ──────────────────────────────────────────
router.get('/cost-per-sale', async (req, res) => {
  try {
    const companyId = companyIdFor(req);
    const { range, start, end } = req.query;

    const now = new Date();
    let from, to = now;
    if (start && end) {
      from = new Date(start);
      to = new Date(end); to.setHours(23, 59, 59, 999);
    } else {
      const days = parseInt(range) || 90;
      from = new Date(now); from.setDate(from.getDate() - days);
    }

    const result = await pool.query(
      `SELECT
        COALESCE(l.utm_source, 'organic') AS source,
        COALESCE(c.cpl_amount, 0) AS cpl,
        COUNT(*)::int AS total_leads,
        (COUNT(*) * COALESCE(c.cpl_amount, 0))::numeric AS total_ad_spend,
        COUNT(CASE WHEN l.sold_at IS NOT NULL AND l.contract_price IS NOT NULL THEN 1 END)::int AS sold_with_price,
        ROUND(AVG(CASE WHEN l.sold_at IS NOT NULL AND l.contract_price IS NOT NULL
          THEN l.contract_price END)::numeric, 2) AS avg_contract_price,
        COALESCE(SUM(CASE WHEN l.sold_at IS NOT NULL AND l.contract_price IS NOT NULL
          THEN l.contract_price ELSE 0 END), 0)::numeric AS total_revenue
      FROM leads l
      LEFT JOIN lead_source_cpl c
        ON c.company_id = l.company_id AND c.utm_source = COALESCE(l.utm_source, 'organic')
      WHERE l.company_id = $1
        AND l.status != 'status_junk'
        AND l.deleted_at IS NULL
        AND l.created_at >= $2 AND l.created_at <= $3
      GROUP BY COALESCE(l.utm_source, 'organic'), c.cpl_amount
      ORDER BY total_leads DESC`,
      [companyId, from, to]
    );

    const mapRow = (r) => {
      const cpl = parseFloat(r.cpl) || 0;
      const totalLeads = r.total_leads;
      const totalAdSpend = parseFloat(r.total_ad_spend) || 0;
      const soldWithPrice = r.sold_with_price;
      const avgContract = r.avg_contract_price != null ? parseFloat(r.avg_contract_price) : null;
      const totalRevenue = parseFloat(r.total_revenue) || 0;
      const costPerSale = soldWithPrice > 0 ? totalAdSpend / soldWithPrice : null;
      const adCostPct = totalRevenue > 0 ? Math.round((totalAdSpend / totalRevenue) * 1000) / 10 : null;
      return { source: r.source, cpl, totalLeads, totalAdSpend, soldWithPrice, avgContractPrice: avgContract, totalRevenue, costPerSale, adCostPctOfRevenue: adCostPct };
    };

    const rows = result.rows.map(mapRow);
    const totalLeads = rows.reduce((s, r) => s + r.totalLeads, 0);
    const totalAdSpend = rows.reduce((s, r) => s + r.totalAdSpend, 0);
    const soldWithPrice = rows.reduce((s, r) => s + r.soldWithPrice, 0);
    const totalRevenue = rows.reduce((s, r) => s + r.totalRevenue, 0);
    const totals = {
      cpl: null,
      totalLeads,
      totalAdSpend,
      soldWithPrice,
      avgContractPrice: soldWithPrice > 0 ? totalRevenue / soldWithPrice : null,
      totalRevenue,
      costPerSale: soldWithPrice > 0 ? totalAdSpend / soldWithPrice : null,
      adCostPctOfRevenue: totalRevenue > 0 ? Math.round((totalAdSpend / totalRevenue) * 1000) / 10 : null,
    };

    res.json({ success: true, rows, totals });
  } catch (error) {
    console.error('[GET /api/reports/cost-per-sale]', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/reports/source-cpls ────────────────────────────────────────────
router.get('/source-cpls', async (req, res) => {
  try {
    const companyId = companyIdFor(req);

    const [sourcesRes, cplsRes] = await Promise.all([
      pool.query(
        `SELECT DISTINCT COALESCE(utm_source, 'organic') AS source
         FROM leads
         WHERE company_id = $1 AND deleted_at IS NULL AND status != 'status_junk'
         ORDER BY source`,
        [companyId]
      ),
      pool.query(
        `SELECT utm_source, cpl_amount FROM lead_source_cpl WHERE company_id = $1`,
        [companyId]
      ),
    ]);

    const cplMap = {};
    for (const row of cplsRes.rows) cplMap[row.utm_source] = parseFloat(row.cpl_amount) || 0;

    const sources = sourcesRes.rows.map((r) => ({
      source: r.source,
      cpl: cplMap[r.source] ?? 0,
    }));

    res.json({ success: true, sources });
  } catch (error) {
    console.error('[GET /api/reports/source-cpls]', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── PUT /api/reports/source-cpls ────────────────────────────────────────────
router.put('/source-cpls', async (req, res) => {
  try {
    const companyId = companyIdFor(req);
    const { cpls } = req.body;
    if (!Array.isArray(cpls)) return res.status(400).json({ error: 'cpls array required' });

    for (const { source, cpl } of cpls) {
      if (!source) continue;
      await pool.query(
        `INSERT INTO lead_source_cpl (company_id, utm_source, cpl_amount, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (company_id, utm_source)
         DO UPDATE SET cpl_amount = EXCLUDED.cpl_amount, updated_at = NOW()`,
        [companyId, source, parseFloat(cpl) || 0]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[PUT /api/reports/source-cpls]', error);
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

// ─── POST /api/reports/mark-junk ─────────────────────────────────────────────
// Sets a lead's status to status_junk, excluding it from future orphan checks.
// ─── GET /api/reports/speed-to-lead ─────────────────────────────────────────
// Returns avg lead-to-first-outbound-call time, grouped by current status.
// Fetches call data live from GHL on first run, then caches in leads.first_call_at.

const TARGET_STATUSES = [
  { status: 'status_pre_lead', label: 'Pre-Lead' },
  { status: 'lead',            label: 'Lead' },
  { status: 'appointment_set', label: 'Appt Booked' },
  { status: 'sold',            label: 'Sold' },
  { status: 'not_sold',        label: 'Not Sold' },
];

async function fetchAndCacheFirstCall(lead, company) {
  try {
    const convResult = await ghl.searchConversations(company, { contactId: lead.ghl_contact_id });
    const conversations = convResult?.conversations || [];
    if (!conversations.length) return null;

    const msgResult = await ghl.getMessagesByConversationId(conversations[0].id, company, 100);
    const messages = Array.isArray(msgResult?.messages) ? msgResult.messages
      : Array.isArray(msgResult?.messages?.messages) ? msgResult.messages.messages : [];

    const outboundCalls = messages.filter((m) =>
      (m.type === 10 || m.messageType === 'TYPE_CALL') &&
      (m.direction === 'outbound' || m.direction === 1)
    );
    if (!outboundCalls.length) return null;

    outboundCalls.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
    const firstCallAt = new Date(outboundCalls[0].dateAdded);

    await pool.query(`UPDATE leads SET first_call_at = $1 WHERE id = $2`, [firstCallAt, lead.id]);
    lead.first_call_at = firstCallAt;
    return firstCallAt;
  } catch (err) {
    console.error(`[speed-to-lead] lead ${lead.id}:`, err.message);
    return null;
  }
}

router.get('/speed-to-lead', async (req, res) => {
  try {
    const companyId = companyIdFor(req);
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start and end dates are required' });

    const company = await loadCompanyWithGHL(companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const statusList = TARGET_STATUSES.map((s) => s.status);
    const placeholders = statusList.map((_, i) => `$${i + 4}`).join(',');

    const leadsResult = await pool.query(
      `SELECT id, status, created_at, ghl_contact_id, first_call_at
       FROM leads
       WHERE company_id = $1
         AND deleted_at IS NULL
         AND status IN (${placeholders})
         AND created_at >= $2::timestamptz
         AND created_at < ($3::date + INTERVAL '1 day')::timestamptz`,
      [companyId, start, end, ...statusList]
    );

    const leads = leadsResult.rows;

    // Fetch + cache first_call_at for leads that don't have it yet
    const needsFetch = leads.filter((l) => l.ghl_contact_id && !l.first_call_at && company.ghl_api_key);
    const BATCH = 5;
    for (let i = 0; i < needsFetch.length; i += BATCH) {
      await Promise.all(needsFetch.slice(i, i + BATCH).map((l) => fetchAndCacheFirstCall(l, company)));
    }

    // Aggregate by status
    const rows = TARGET_STATUSES.map(({ status, label }) => {
      const bucket = leads.filter((l) => l.status === status);
      const reached = bucket.filter((l) => l.first_call_at);
      let avgMinutes = null;
      if (reached.length) {
        const totalMs = reached.reduce((s, l) => s + (new Date(l.first_call_at) - new Date(l.created_at)), 0);
        avgMinutes = Math.round(totalMs / reached.length / 60000);
      }
      return { status, label, count: bucket.length, reached: reached.length, avgMinutes };
    });

    const allReached = leads.filter((l) => l.first_call_at);
    let overallAvg = null;
    if (allReached.length) {
      const totalMs = allReached.reduce((s, l) => s + (new Date(l.first_call_at) - new Date(l.created_at)), 0);
      overallAvg = Math.round(totalMs / allReached.length / 60000);
    }

    res.json({
      rows,
      overall: { count: leads.length, reached: allReached.length, avgMinutes: overallAvg },
      synced: needsFetch.length,
    });
  } catch (error) {
    console.error('[GET /api/reports/speed-to-lead]', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/mark-junk', async (req, res) => {
  try {
    if (req.user.role !== 'master') return res.status(403).json({ error: 'Master only' });

    const { lead_id, company_id } = req.body;
    if (!lead_id || !company_id) return res.status(400).json({ error: 'lead_id and company_id required' });

    await pool.query(
      `UPDATE leads SET status = 'status_junk' WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [lead_id, company_id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('[POST /api/reports/mark-junk]', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
