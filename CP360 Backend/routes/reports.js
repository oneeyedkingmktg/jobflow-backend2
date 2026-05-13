const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// GET /api/reports/lifecycle
// Returns lifecycle timing and close-rate metrics, split by estimator vs non-estimator.
// Excludes junk leads and soft-deleted leads.
router.get('/lifecycle', async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const result = await pool.query(
      `SELECT
        CASE WHEN lead_source = 'estimator' THEN 'estimator' ELSE 'non_estimator' END AS category,
        COUNT(*) AS total_leads,
        COUNT(CASE WHEN appointment_date IS NOT NULL THEN 1 END) AS leads_with_appt,
        COUNT(CASE WHEN status IN ('sold', 'complete') THEN 1 END) AS sold_leads,
        ROUND(AVG(
          CASE WHEN appointment_date IS NOT NULL
            THEN EXTRACT(EPOCH FROM (appointment_date::timestamp - created_at)) / 86400
          END
        )::numeric, 1) AS avg_lead_to_appt_days,
        ROUND(AVG(
          CASE WHEN sold_at IS NOT NULL AND appointment_date IS NOT NULL
            THEN EXTRACT(EPOCH FROM (sold_at - appointment_date::timestamp)) / 86400
          END
        )::numeric, 1) AS avg_appt_to_sold_days
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
      const total = parseInt(row.total_leads);
      const withAppt = parseInt(row.leads_with_appt);
      const sold = parseInt(row.sold_leads);

      metrics[row.category] = {
        totalLeads: total,
        leadsWithAppt: withAppt,
        soldLeads: sold,
        avgLeadToApptDays: row.avg_lead_to_appt_days != null ? parseFloat(row.avg_lead_to_appt_days) : null,
        avgApptToSoldDays: row.avg_appt_to_sold_days != null ? parseFloat(row.avg_appt_to_sold_days) : null,
        leadToApptRate: total > 0 ? Math.round(withAppt * 100 / total) : 0,
        apptToSoldRate: withAppt > 0 ? Math.round(sold * 100 / withAppt) : 0,
      };
    }

    res.json({ success: true, metrics });
  } catch (error) {
    console.error('[GET /api/reports/lifecycle]', error);
    res.status(500).json({ error: 'Failed to fetch report data' });
  }
});

module.exports = router;
