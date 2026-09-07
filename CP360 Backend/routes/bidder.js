// ============================================================================
// File: routes/bidder.js
// Bidder feature — proposals, items, library, company settings, designs
// ============================================================================

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { sendProposalAcceptedEmails, sendProposalLinkEmail, sendPaymentReceivedEmail, sendWarrantyEmail } = require('../services/email');
const Stripe = require('stripe');
const axios = require('axios');
const multer = require('multer');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { r2, BUCKET, PUBLIC_URL } = require('../config/r2');
const crypto = require('crypto');

const logoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const PAYPAL_BASE = 'https://api-m.paypal.com';

async function getPayPalAccessToken(clientId, secret) {
  const res = await axios.post(
    `${PAYPAL_BASE}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      auth: { username: clientId, password: secret },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );
  return res.data.access_token;
}

// Same scramble as docId() in the frontend — converts sequential DB id → 6-digit doc number
function docNum(id) {
  return ((id * 982451 + 123457) % 900000) + 100000;
}

// Default library items seeded for new companies
const DEFAULT_LIBRARY = [
  {
    category: 'Coating Systems',
    items: [
      { name: 'MVB',                  default_unit_price: 0.85, default_unit_label: 'per sqft', default_description: 'Moisture vapor barrier primer coat' },
      { name: 'Polyaspartic Base',    default_unit_price: 1.40, default_unit_label: 'per sqft', default_description: 'Full broadcast base coat' },
      { name: 'Flake Broadcast',      default_unit_price: 0.60, default_unit_label: 'per sqft', default_description: 'Decorative flake layer' },
      { name: 'Polyaspartic Topcoat', default_unit_price: 1.10, default_unit_label: 'per sqft', default_description: 'UV stable clear topcoat' },
      { name: 'Metallic Epoxy',       default_unit_price: 2.20, default_unit_label: 'per sqft', default_description: 'Metallic pigment decorative coat' },
    ],
  },
];

// Default T&C text
const DEFAULT_TERMS = `TERMS AND CONDITIONS

1. SCOPE OF WORK: The contractor agrees to perform only the work described in this proposal. Any additional work requested by the customer will require a separate written agreement.

2. PAYMENT: The down payment is due upon acceptance of this proposal. The remaining balance is due upon completion of work.

3. SURFACE PREPARATION: Customer is responsible for clearing the work area prior to the start date. Contractor is not responsible for moving vehicles, furniture, or stored items unless otherwise agreed in writing.

4. CURE TIME: Coatings require adequate cure time before use. Contractor will advise on appropriate wait times. Customer agrees not to use the coated surface before the recommended cure period.

5. MOISTURE: Contractor is not responsible for coating failures caused by pre-existing moisture issues, hydrostatic pressure, or water intrusion not identified during initial consultation.

6. EXISTING CRACKS & DAMAGE: Surface cracks and minor damage will be repaired as described in the proposal. Structural issues are not included in this agreement.

7. WARRANTY: Contractor warrants workmanship for one (1) year from the date of installation. Material warranties are provided by the manufacturer and are separate from this agreement.

8. CANCELLATION: Customer may cancel this agreement within 3 business days of signing. After that period, the down payment is non-refundable if materials have been ordered or work has been scheduled.

9. ACCESS: Customer agrees to provide safe access to the work area on the scheduled installation date. If access is denied on the scheduled date, a rescheduling fee may apply.

10. CHANGES: Any changes to the scope of work must be agreed upon in writing by both parties before work begins.

11. LIMITATION OF LIABILITY: Contractor's total liability shall not exceed the total contract price. Contractor is not liable for incidental or consequential damages.

12. DISPUTE RESOLUTION: Any disputes arising from this agreement shall first be subject to mediation before litigation.

13. ENTIRE AGREEMENT: This proposal, once accepted, constitutes the entire agreement between the parties and supersedes all prior discussions.`;

// ============================================================================
// AUTH — protect all routes; public proposal routes excluded below
// ============================================================================
router.use((req, res, next) => {
  // Public: web proposal page and accept endpoint use token in URL
  if (req.path.startsWith('/public/')) return next();
  return authenticateToken(req, res, next);
});

// Master users: always reset company_id from query param (or null if absent).
// This ensures IS NULL bypasses in WHERE clauses work correctly for masters
// who may have a non-null company_id baked into their JWT.
router.use((req, res, next) => {
  if (req.path.startsWith('/public/')) return next();
  if (req.user && req.user.role === 'master') {
    const cid = req.query.company_id || req.body?.company_id;
    req.user.company_id = cid ? parseInt(cid) : null;
  }
  next();
});

const clean = (v) => (v === '' || v === undefined ? null : v);

// ============================================================================
// PROPOSALS
// ============================================================================

// GET /api/bidder/proposals/by-job/:jobId — all proposals for a specific job
router.get('/proposals/by-job/:jobId', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { jobId } = req.params;

    const result = await pool.query(
      `SELECT id, bid_name, bid_description, status, presented_date, accepted_date,
              bid_total, created_at, updated_at, paid_at, final_paid_at
       FROM bidder_proposals
       WHERE job_id = $1 AND ($2::integer IS NULL OR company_id = $2::integer)
       ORDER BY
         CASE status
           WHEN 'pending'  THEN 1
           WHEN 'accepted' THEN 2
           ELSE 3
         END,
         presented_date DESC NULLS LAST,
         created_at DESC`,
      [jobId, companyId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('GET /bidder/proposals/by-job error:', err);
    res.status(500).json({ error: 'Failed to fetch proposals' });
  }
});

// GET /api/bidder/proposals/:leadId — all proposals for a lead (selection screen)
router.get('/proposals/:leadId', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { leadId } = req.params;

    const result = await pool.query(
      `SELECT id, bid_name, bid_description, status, presented_date, accepted_date,
              bid_total, created_at, updated_at, paid_at, final_paid_at
       FROM bidder_proposals
       WHERE lead_id = $1 AND ($2::integer IS NULL OR company_id = $2::integer)
       ORDER BY
         CASE status
           WHEN 'pending'  THEN 1
           WHEN 'accepted' THEN 2
           ELSE 3
         END,
         presented_date DESC NULLS LAST,
         created_at DESC`,
      [leadId, companyId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('GET /bidder/proposals error:', err);
    res.status(500).json({ error: 'Failed to fetch proposals' });
  }
});

// GET /api/bidder/proposal/:id/materials — compute materials / order list for a bid
router.get('/proposal/:id/materials', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const propCheck = await pool.query(
      'SELECT id FROM bidder_proposals WHERE id = $1 AND ($2::integer IS NULL OR company_id = $2::integer)',
      [id, companyId]
    );
    if (!propCheck.rows.length) return res.status(404).json({ error: 'Proposal not found' });

    // Fetch proposal items — resolve effective kit_price/sqft_per_kit via supplier inheritance
    const itemsResult = await pool.query(
      `SELECT bpi.id, bpi.library_item_id, bpi.quantity,
              COALESCE(li.internal_name, li.name) AS lib_name,
              CASE WHEN li.source_supplier_product_id IS NOT NULL
                   THEN COALESCE(li.cost_override, gsp.kit_price)
                   ELSE li.kit_price END AS kit_price,
              CASE WHEN li.source_supplier_product_id IS NOT NULL
                   THEN COALESCE(li.coverage_override, gsp.sqft_per_kit)
                   ELSE li.sqft_per_kit END AS sqft_per_kit,
              li.is_system, li.is_charge_only
       FROM bidder_proposal_items bpi
       JOIN bidder_library_items li ON li.id = bpi.library_item_id
       LEFT JOIN global_supplier_products gsp ON li.source_supplier_product_id = gsp.id
       WHERE bpi.proposal_id = $1
         AND bpi.library_item_id IS NOT NULL
         AND bpi.is_freeform = false
       ORDER BY bpi.sort_order, bpi.id`,
      [id]
    );

    // For system items, fetch component details — also resolve effective cost/coverage
    const systemLibIds = itemsResult.rows.filter(r => r.is_system).map(r => r.library_item_id);
    let componentsBySystem = {};
    if (systemLibIds.length > 0) {
      const compResult = await pool.query(
        `SELECT sc.system_item_id, sc.component_item_id,
                COALESCE(li.internal_name, li.name) AS name,
                CASE WHEN li.source_supplier_product_id IS NOT NULL
                     THEN COALESCE(li.cost_override, gsp.kit_price)
                     ELSE li.kit_price END AS kit_price,
                CASE WHEN li.source_supplier_product_id IS NOT NULL
                     THEN COALESCE(li.coverage_override, gsp.sqft_per_kit)
                     ELSE li.sqft_per_kit END AS sqft_per_kit,
                li.is_charge_only
         FROM bidder_library_system_components sc
         JOIN bidder_library_items li ON li.id = sc.component_item_id
         LEFT JOIN global_supplier_products gsp ON li.source_supplier_product_id = gsp.id
         WHERE sc.system_item_id = ANY($1)
         ORDER BY sc.sort_order, sc.id`,
        [systemLibIds]
      );
      compResult.rows.forEach(r => {
        if (!componentsBySystem[r.system_item_id]) componentsBySystem[r.system_item_id] = [];
        componentsBySystem[r.system_item_id].push(r);
      });
    }

    // Accumulate areas and sources by library_item_id
    const acc = {}; // library_item_id → { name, kit_price, sqft_per_kit, total_area, sources }

    function addMaterial(libItemId, name, kitPrice, sqftPerKit, area) {
      if (kitPrice == null) return; // No cost data — skip
      const kp = parseFloat(kitPrice);
      const sfk = sqftPerKit ? parseFloat(sqftPerKit) : null;
      if (!acc[libItemId]) {
        acc[libItemId] = { library_item_id: libItemId, name, kit_price: kp, sqft_per_kit: sfk, total_area: 0 };
      }
      acc[libItemId].total_area += parseFloat(area) || 0;
    }

    for (const item of itemsResult.rows) {
      if (item.is_charge_only) continue;
      if (item.is_system) {
        const components = componentsBySystem[item.library_item_id] || [];
        for (const comp of components) {
          if (comp.is_charge_only) continue;
          addMaterial(comp.component_item_id, comp.name, comp.kit_price, comp.sqft_per_kit, item.quantity);
        }
      } else {
        addMaterial(item.library_item_id, item.lib_name, item.kit_price, item.sqft_per_kit, item.quantity);
      }
    }

    // Load saved overrides for this proposal
    const ovResult = await pool.query(
      'SELECT library_item_id, order_qty, unit_cost FROM bid_material_overrides WHERE proposal_id = $1',
      [id]
    );
    const overrides = {};
    ovResult.rows.forEach(r => { overrides[r.library_item_id] = r; });

    const materials = Object.values(acc).map(item => {
      let calculated_qty = null;
      let default_order_qty = null;

      if (item.sqft_per_kit && item.total_area > 0) {
        calculated_qty = item.total_area / item.sqft_per_kit;
        default_order_qty = Math.max(1, Math.ceil(calculated_qty));
      }

      const ov = overrides[item.library_item_id] || {};
      const order_qty = ov.order_qty != null ? parseFloat(ov.order_qty) : default_order_qty;
      const unit_cost = ov.unit_cost != null ? parseFloat(ov.unit_cost) : (item.kit_price || 0);
      const extended_cost = (order_qty || 0) * (unit_cost || 0);

      return {
        library_item_id: item.library_item_id,
        name: item.name,
        total_area: item.total_area,
        sqft_per_kit: item.sqft_per_kit,
        kit_price: item.kit_price,
        calculated_qty,
        default_order_qty,
        order_qty,
        unit_cost,
        extended_cost,
        has_override_qty:  ov.order_qty != null,
        has_override_cost: ov.unit_cost != null,
      };
    });

    const total_projected_cost = materials.reduce((sum, m) => sum + (m.extended_cost || 0), 0);
    res.json({ materials, total_projected_cost });
  } catch (err) {
    console.error('GET /bidder/proposal/:id/materials error:', err);
    res.status(500).json({ error: 'Failed to generate materials list' });
  }
});

// PUT /api/bidder/proposal/:id/materials — save order qty / unit cost overrides
router.put('/proposal/:id/materials', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const { overrides } = req.body; // [{ library_item_id, order_qty, unit_cost }]

    const propCheck = await pool.query(
      'SELECT id FROM bidder_proposals WHERE id = $1 AND ($2::integer IS NULL OR company_id = $2::integer)',
      [id, companyId]
    );
    if (!propCheck.rows.length) return res.status(404).json({ error: 'Proposal not found' });

    if (!Array.isArray(overrides) || overrides.length === 0) return res.json({ ok: true });

    for (const ov of overrides) {
      await pool.query(
        `INSERT INTO bid_material_overrides (proposal_id, library_item_id, order_qty, unit_cost, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (proposal_id, library_item_id)
         DO UPDATE SET order_qty = EXCLUDED.order_qty, unit_cost = EXCLUDED.unit_cost, updated_at = NOW()`,
        [id, ov.library_item_id, ov.order_qty ?? null, ov.unit_cost ?? null]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /bidder/proposal/:id/materials error:', err);
    res.status(500).json({ error: 'Failed to save material overrides' });
  }
});

// GET /api/bidder/proposal/:id — single proposal with all child records
router.get('/proposal/:id', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const proposalResult = await pool.query(
      `SELECT bp.*, u.name AS created_by_name
       FROM bidder_proposals bp
       LEFT JOIN users u ON bp.created_by_user_id = u.id
       WHERE bp.id = $1 AND ($2::integer IS NULL OR bp.company_id = $2::integer)`,
      [id, companyId]
    );

    if (!proposalResult.rows.length) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const proposal = proposalResult.rows[0];

    const [items, customItems, discounts, paymentSchedules] = await Promise.all([
      pool.query(
        'SELECT * FROM bidder_proposal_items WHERE proposal_id = $1 ORDER BY sort_order, id',
        [id]
      ),
      pool.query(
        'SELECT * FROM bidder_custom_items WHERE proposal_id = $1 ORDER BY sort_order, id',
        [id]
      ),
      pool.query(
        'SELECT * FROM bidder_discounts WHERE proposal_id = $1 ORDER BY sort_order, id',
        [id]
      ),
      pool.query(
        'SELECT * FROM bidder_payment_schedules WHERE proposal_id = $1 ORDER BY sort_order, id',
        [id]
      ),
    ]);

    res.json({
      ...proposal,
      items: items.rows,
      customItems: customItems.rows,
      discounts: discounts.rows,
      paymentSchedules: paymentSchedules.rows,
    });
  } catch (err) {
    console.error('GET /bidder/proposal/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch proposal' });
  }
});

// POST /api/bidder/proposal — create new proposal
router.post('/proposal', async (req, res) => {
  try {
    const companyId = req.user.company_id || parseInt(req.body.company_id) || null;
    const salesman = req.body.salesman || req.user.name || req.user.email || '';
    const {
      lead_id, job_id, bid_name, bid_description, status = 'pending',
      presented_date, accepted_date, install_crew, install_date,
      install_date_tbd = false, output_mode = 'lump_sum',
      customer_notes, internal_notes, bid_total = 0,
      down_payment_type = 'percent', down_payment_value = 50,
      down_payment_amount = 0, balance_due = 0,
      payment_url, include_payment_button = true, proposal_design_id,
    } = req.body;

    if (!lead_id || !bid_name) {
      return res.status(400).json({ error: 'lead_id and bid_name are required' });
    }

    const result = await pool.query(
      `INSERT INTO bidder_proposals (
        lead_id, job_id, company_id, bid_name, bid_description, status,
        presented_date, accepted_date, salesman, install_crew, install_date,
        install_date_tbd, output_mode, customer_notes, internal_notes,
        bid_total, down_payment_type, down_payment_value, down_payment_amount,
        balance_due, payment_url, include_payment_button, proposal_design_id,
        created_by_user_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
      ) RETURNING *`,
      [
        lead_id, job_id || null, companyId, bid_name, clean(bid_description), status,
        clean(presented_date), clean(accepted_date), salesman, clean(install_crew),
        clean(install_date), install_date_tbd, output_mode,
        clean(customer_notes), clean(internal_notes),
        bid_total, down_payment_type, down_payment_value, down_payment_amount,
        balance_due, clean(payment_url), include_payment_button, clean(proposal_design_id),
        req.user.id || null,
      ]
    );

    const newId = result.rows[0].id;
    const dn = docNum(newId);
    await pool.query('UPDATE bidder_proposals SET doc_number = $1 WHERE id = $2', [dn, newId]);
    result.rows[0].doc_number = dn;

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /bidder/proposal error:', err);
    res.status(500).json({ error: 'Failed to create proposal' });
  }
});

// PUT /api/bidder/proposal/:id — update proposal
router.put('/proposal/:id', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const {
      bid_name, bid_description, status, presented_date, accepted_date,
      install_crew, install_date, install_date_tbd, output_mode = 'lump_sum',
      customer_notes, internal_notes, bid_total, down_payment_type = 'percent',
      down_payment_value = 50, down_payment_amount = 0, balance_due,
      payment_url, include_payment_button, proposal_design_id, salesman,
      site_conditions, warranty_id, override_total,
    } = req.body;

    // Auto-set accepted_date when status transitions to accepted and no date was provided
    const resolvedAcceptedDate = (status === 'accepted' && !accepted_date) ? new Date() : clean(accepted_date);

    const result = await pool.query(
      `UPDATE bidder_proposals SET
        bid_name = $1, bid_description = $2, status = $3,
        presented_date = $4, accepted_date = $5, install_crew = $6,
        install_date = $7, install_date_tbd = $8, output_mode = $9,
        customer_notes = $10, internal_notes = $11, bid_total = $12,
        down_payment_type = $13, down_payment_value = $14,
        down_payment_amount = $15, balance_due = $16,
        payment_url = $17, include_payment_button = $18,
        proposal_design_id = $19, salesman = $20,
        site_conditions = $21, warranty_id = $22,
        override_total = $23, updated_at = NOW()
       WHERE id = $24 AND ($25::integer IS NULL OR company_id = $25::integer)
       RETURNING *`,
      [
        bid_name, clean(bid_description), status,
        clean(presented_date), resolvedAcceptedDate, clean(install_crew),
        clean(install_date), install_date_tbd, output_mode,
        clean(customer_notes), clean(internal_notes), bid_total,
        down_payment_type, down_payment_value,
        down_payment_amount, balance_due,
        clean(payment_url), include_payment_button,
        clean(proposal_design_id), salesman ?? null,
        site_conditions ? JSON.stringify(site_conditions) : '{}',
        warranty_id ? parseInt(warranty_id) : null,
        override_total != null && override_total !== '' ? parseFloat(override_total) : null,
        id, companyId,
      ]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Proposal not found' });

    // On acceptance: sync bid_total → contract_price; set job status → sold
    if (status === 'accepted') {
      const { job_id: syncJobId, lead_id: syncLeadId } = result.rows[0];
      const syncPrice = bid_total != null ? parseFloat(bid_total) : null;
      const syncs = [];
      if (syncJobId) {
        syncs.push(pool.query(
          `UPDATE jobs SET contract_price = COALESCE($1, contract_price), status = 'sold' WHERE id = $2`,
          [syncPrice, syncJobId]
        ));
      }
      if (syncLeadId && syncPrice != null) {
        syncs.push(pool.query('UPDATE leads SET contract_price = $1 WHERE id = $2', [syncPrice, syncLeadId]));
      }
      await Promise.all(syncs);
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /bidder/proposal/:id error:', err);
    res.status(500).json({ error: 'Failed to update proposal' });
  }
});

// DELETE /api/bidder/proposal/:id
router.delete('/proposal/:id', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const result = await pool.query(
      'DELETE FROM bidder_proposals WHERE id = $1 AND ($2::integer IS NULL OR company_id = $2::integer) RETURNING id',
      [req.params.id, companyId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Proposal not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /bidder/proposal/:id error:', err);
    res.status(500).json({ error: 'Failed to delete proposal' });
  }
});

// ============================================================================
// PROPOSAL ITEMS
// ============================================================================

// POST /api/bidder/item
router.post('/item', async (req, res) => {
  try {
    const {
      proposal_id, library_item_id, category_name, name, description,
      unit_price = 0, unit_label, quantity, line_total = 0,
      is_included = false, is_optional = false, is_freeform = false,
      breakout_price = false, show_price = true, show_quantity = true, sort_order = 0,
      color,
    } = req.body;

    // Verify proposal belongs to this company
    const companyId = req.user.company_id;
    const check = await pool.query(
      'SELECT id FROM bidder_proposals WHERE id = $1 AND ($2::integer IS NULL OR company_id = $2::integer)',
      [proposal_id, companyId]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Proposal not found' });

    const result = await pool.query(
      `INSERT INTO bidder_proposal_items (
        proposal_id, library_item_id, category_name, name, description,
        unit_price, unit_label, quantity, line_total, is_included,
        is_optional, is_freeform, breakout_price, sort_order, color
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [
        proposal_id, clean(library_item_id), clean(category_name), name, clean(description),
        unit_price, clean(unit_label), clean(quantity), line_total, is_included,
        is_optional, is_freeform, breakout_price, sort_order, clean(color) || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /bidder/item error:', err);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// PUT /api/bidder/item/:id
router.put('/item/:id', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const {
      category_name, name, description, unit_price, unit_label,
      quantity, line_total, is_included, is_optional, is_accepted,
      breakout_price, show_price, show_quantity, sort_order, color,
    } = req.body;

    const result = await pool.query(
      `UPDATE bidder_proposal_items pi
       SET category_name = $1, name = $2, description = $3, unit_price = $4,
           unit_label = $5, quantity = $6, line_total = $7, is_included = $8,
           is_optional = $9, is_accepted = $10, breakout_price = $11, sort_order = $12,
           show_price = $13, show_quantity = $14, color = $15
       FROM bidder_proposals p
       WHERE pi.id = $16 AND pi.proposal_id = p.id AND ($17::integer IS NULL OR p.company_id = $17::integer)
       RETURNING pi.*`,
      [
        clean(category_name), name, clean(description), unit_price,
        clean(unit_label), clean(quantity), line_total, is_included,
        is_optional, clean(is_accepted), breakout_price ?? false, sort_order,
        show_price ?? true, show_quantity ?? true, clean(color) || null,
        req.params.id, companyId,
      ]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Item not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /bidder/item/:id error:', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /api/bidder/item/:id
router.delete('/item/:id', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const result = await pool.query(
      `DELETE FROM bidder_proposal_items pi
       USING bidder_proposals p
       WHERE pi.id = $1 AND pi.proposal_id = p.id AND ($2::integer IS NULL OR p.company_id = $2::integer)
       RETURNING pi.id`,
      [req.params.id, companyId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Item not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /bidder/item/:id error:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// ============================================================================
// CUSTOM ITEMS
// ============================================================================

// POST /api/bidder/custom-item
router.post('/custom-item', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { proposal_id, description, quantity = 1, price_each = 0, line_total = 0, sort_order = 0, is_subtotal = false, is_note = false } = req.body;

    const check = await pool.query(
      'SELECT id FROM bidder_proposals WHERE id = $1 AND ($2::integer IS NULL OR company_id = $2::integer)',
      [proposal_id, companyId]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Proposal not found' });

    // is_note and show_price/show_quantity columns require a migration — use fallback if not yet applied
    let result;
    try {
      result = await pool.query(
        `INSERT INTO bidder_custom_items (proposal_id, description, quantity, price_each, line_total, sort_order, is_subtotal, is_note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [proposal_id, description, quantity, price_each, line_total, sort_order, is_subtotal, is_note]
      );
    } catch (e) {
      if (e.message && e.message.includes('column') && e.message.includes('does not exist')) {
        result = await pool.query(
          `INSERT INTO bidder_custom_items (proposal_id, description, quantity, price_each, line_total, sort_order, is_subtotal)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [proposal_id, description, quantity, price_each, line_total, sort_order, is_subtotal]
        );
      } else { throw e; }
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /bidder/custom-item error:', err);
    res.status(500).json({ error: 'Failed to add custom item' });
  }
});

// PUT /api/bidder/custom-item/:id
router.put('/custom-item/:id', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { description, quantity, price_each, line_total, sort_order, show_price, show_quantity, subtotal_note } = req.body;

    let result;
    try {
      result = await pool.query(
        `UPDATE bidder_custom_items ci
         SET description = $1, quantity = $2, price_each = $3, line_total = $4, sort_order = $5,
             show_price = $6, show_quantity = $7, subtotal_note = $8
         FROM bidder_proposals p
         WHERE ci.id = $9 AND ci.proposal_id = p.id AND ($10::integer IS NULL OR p.company_id = $10::integer)
         RETURNING ci.*`,
        [description, quantity, price_each, line_total, sort_order, show_price ?? true, show_quantity ?? true, subtotal_note ?? null, req.params.id, companyId]
      );
    } catch (e) {
      if (e.message && e.message.includes('column') && e.message.includes('does not exist')) {
        result = await pool.query(
          `UPDATE bidder_custom_items ci
           SET description = $1, quantity = $2, price_each = $3, line_total = $4, sort_order = $5
           FROM bidder_proposals p
           WHERE ci.id = $6 AND ci.proposal_id = p.id AND ($7::integer IS NULL OR p.company_id = $7::integer)
           RETURNING ci.*`,
          [description, quantity, price_each, line_total, sort_order, req.params.id, companyId]
        );
      } else { throw e; }
    }

    if (!result.rows.length) return res.status(404).json({ error: 'Custom item not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /bidder/custom-item/:id error:', err);
    res.status(500).json({ error: 'Failed to update custom item' });
  }
});

// DELETE /api/bidder/custom-item/:id
router.delete('/custom-item/:id', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const result = await pool.query(
      `DELETE FROM bidder_custom_items ci
       USING bidder_proposals p
       WHERE ci.id = $1 AND ci.proposal_id = p.id AND ($2::integer IS NULL OR p.company_id = $2::integer)
       RETURNING ci.id`,
      [req.params.id, companyId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Custom item not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /bidder/custom-item/:id error:', err);
    res.status(500).json({ error: 'Failed to delete custom item' });
  }
});

// ============================================================================
// DISCOUNTS
// ============================================================================

// POST /api/bidder/discount
router.post('/discount', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const {
      proposal_id, description, discount_type = 'dollar',
      discount_value = 0, discount_amount = 0, if_accepted_by, sort_order = 0,
    } = req.body;

    const check = await pool.query(
      'SELECT id FROM bidder_proposals WHERE id = $1 AND ($2::integer IS NULL OR company_id = $2::integer)',
      [proposal_id, companyId]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Proposal not found' });

    const result = await pool.query(
      `INSERT INTO bidder_discounts (proposal_id, description, discount_type, discount_value, discount_amount, if_accepted_by, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [proposal_id, description, discount_type, discount_value, discount_amount, clean(if_accepted_by), sort_order]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /bidder/discount error:', err);
    res.status(500).json({ error: 'Failed to add discount' });
  }
});

// PUT /api/bidder/discount/:id
router.put('/discount/:id', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { description, discount_type, discount_value, discount_amount, if_accepted_by, sort_order } = req.body;

    const result = await pool.query(
      `UPDATE bidder_discounts d
       SET description = $1, discount_type = $2, discount_value = $3,
           discount_amount = $4, if_accepted_by = $5, sort_order = $6
       FROM bidder_proposals p
       WHERE d.id = $7 AND d.proposal_id = p.id AND ($8::integer IS NULL OR p.company_id = $8::integer)
       RETURNING d.*`,
      [description, discount_type, discount_value, discount_amount, clean(if_accepted_by), sort_order, req.params.id, companyId]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Discount not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /bidder/discount/:id error:', err);
    res.status(500).json({ error: 'Failed to update discount' });
  }
});

// DELETE /api/bidder/discount/:id
router.delete('/discount/:id', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const result = await pool.query(
      `DELETE FROM bidder_discounts d
       USING bidder_proposals p
       WHERE d.id = $1 AND d.proposal_id = p.id AND ($2::integer IS NULL OR p.company_id = $2::integer)
       RETURNING d.id`,
      [req.params.id, companyId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Discount not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /bidder/discount/:id error:', err);
    res.status(500).json({ error: 'Failed to delete discount' });
  }
});

// ============================================================================
// ITEM LIBRARY
// ============================================================================

// GET /api/bidder/library — full library for company (with auto-seed)
router.get('/library', async (req, res) => {
  try {
    const companyId = req.user.role === 'master'
      ? (parseInt(req.query.company_id) || req.user.company_id)
      : req.user.company_id;

    const catResult = await pool.query(
      'SELECT * FROM bidder_categories WHERE company_id = $1 ORDER BY sort_order, id',
      [companyId]
    );

    // Auto-seed defaults if library is empty
    if (catResult.rows.length === 0) {
      await pool.transaction(async (client) => {
        for (let ci = 0; ci < DEFAULT_LIBRARY.length; ci++) {
          const cat = DEFAULT_LIBRARY[ci];
          const catRow = await client.query(
            `INSERT INTO bidder_categories (company_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id`,
            [companyId, cat.category, ci]
          );
          const catId = catRow.rows[0].id;
          for (let ii = 0; ii < cat.items.length; ii++) {
            const item = cat.items[ii];
            await client.query(
              `INSERT INTO bidder_library_items (category_id, company_id, name, description, default_unit_price, default_unit_label, sort_order)
               VALUES ($1,$2,$3,$4,$5,$6,$7)`,
              [catId, companyId, item.name, item.default_description, item.default_unit_price, item.default_unit_label, ii]
            );
          }
        }
      });
    }

    // Fetch full library
    const categories = await pool.query(
      'SELECT * FROM bidder_categories WHERE company_id = $1 AND is_active = true ORDER BY sort_order, id',
      [companyId]
    );
    const items = await pool.query(
      `SELECT li.*,
         CASE WHEN li.source_supplier_product_id IS NOT NULL
              THEN COALESCE(li.cost_override, gsp.kit_price)
              ELSE li.kit_price END AS kit_price,
         CASE WHEN li.source_supplier_product_id IS NOT NULL
              THEN COALESCE(li.coverage_override, gsp.sqft_per_kit)
              ELSE li.sqft_per_kit END AS sqft_per_kit
       FROM bidder_library_items li
       LEFT JOIN global_supplier_products gsp ON li.source_supplier_product_id = gsp.id
       WHERE li.company_id = $1
       ORDER BY li.sort_order, li.id`,
      [companyId]
    );

    // Attach components to system items
    const systemIds = items.rows.filter((i) => i.is_system).map((i) => i.id);
    let componentsBySystem = {};
    if (systemIds.length > 0) {
      const compRows = await pool.query(
        `SELECT sc.system_item_id, sc.component_item_id, li.name, li.default_unit_price, li.default_unit_label
         FROM bidder_library_system_components sc
         JOIN bidder_library_items li ON li.id = sc.component_item_id
         WHERE sc.system_item_id = ANY($1)
         ORDER BY sc.sort_order, sc.id`,
        [systemIds]
      );
      compRows.rows.forEach((r) => {
        if (!componentsBySystem[r.system_item_id]) componentsBySystem[r.system_item_id] = [];
        componentsBySystem[r.system_item_id].push(r);
      });
    }

    const enrichedItems = items.rows.map((i) =>
      i.is_system ? { ...i, components: componentsBySystem[i.id] || [] } : i
    );

    // Group items under their categories
    const result = categories.rows.map((cat) => ({
      ...cat,
      items: enrichedItems.filter((i) => i.category_id === cat.id),
    }));

    res.json(result);
  } catch (err) {
    console.error('GET /bidder/library error:', err);
    res.status(500).json({ error: 'Failed to fetch library' });
  }
});

// POST /api/bidder/library/import — CSV bulk import
const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rows = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        cols.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur.trim());
    rows.push(cols);
  }
  return rows;
}

router.post('/library/import', csvUpload.single('csv'), async (req, res) => {
  try {
    const companyId = req.user.company_id;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const text = req.file.buffer.toString('utf8');
    const rows = parseCSV(text);
    if (rows.length < 2) return res.status(400).json({ error: 'CSV is empty or has no data rows' });

    const headers = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
    const idx = (name) => headers.indexOf(name);

    // Validate required headers
    if (idx('category') === -1 || idx('name') === -1) {
      return res.status(400).json({ error: 'CSV must have at least "category" and "name" columns' });
    }

    // Fetch existing categories for this company
    const catResult = await pool.query(
      'SELECT * FROM bidder_categories WHERE company_id = $1 ORDER BY sort_order, id',
      [companyId]
    );
    const categoryCache = {};
    catResult.rows.forEach((c) => { categoryCache[c.name.toLowerCase()] = c; });

    let created = 0, skipped = 0, errors = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (row.every((c) => !c)) continue; // blank row

      const get = (col) => (idx(col) !== -1 ? (row[idx(col)] || '').trim() : '');
      const catName = get('category');
      const name    = get('name');

      if (!catName || !name) { skipped++; errors.push(`Row ${r + 1}: missing category or name`); continue; }

      // Find or create category
      let cat = categoryCache[catName.toLowerCase()];
      if (!cat) {
        const newCat = await pool.query(
          'INSERT INTO bidder_categories (company_id, name, sort_order) VALUES ($1,$2,$3) RETURNING *',
          [companyId, catName, Object.keys(categoryCache).length]
        );
        cat = newCat.rows[0];
        categoryCache[catName.toLowerCase()] = cat;
      }

      const isChargeOnly = /^(yes|true|1)$/i.test(get('is_charge_only'));
      const unitPrice    = parseFloat(get('default_unit_price')) || 0;
      const kitPrice     = !isChargeOnly && get('kit_price') ? parseFloat(get('kit_price')) || null : null;
      const sqftPerKit   = !isChargeOnly && get('sqft_per_kit') ? parseFloat(get('sqft_per_kit')) || null : null;
      const supplier     = isChargeOnly ? null : (get('supplier') || null);
      const sku          = isChargeOnly ? null : (get('sku') || null);

      // Count existing items in this category for sort_order
      const countRes = await pool.query(
        'SELECT COUNT(*) FROM bidder_library_items WHERE category_id = $1 AND company_id = $2',
        [cat.id, companyId]
      );
      const sortOrder = parseInt(countRes.rows[0].count, 10);

      await pool.query(
        `INSERT INTO bidder_library_items
          (category_id, company_id, name, description, default_unit_price, default_unit_label,
           supplier, sku, kit_price, sqft_per_kit, is_charge_only, color, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          cat.id, companyId, name,
          get('description') || null,
          unitPrice,
          get('default_unit_label') || null,
          supplier, sku, kitPrice, sqftPerKit,
          isChargeOnly, get('color') || null, sortOrder,
        ]
      );
      created++;
    }

    res.json({ created, skipped, errors });
  } catch (err) {
    console.error('POST /bidder/library/import error:', err);
    res.status(500).json({ error: 'Import failed' });
  }
});

// POST /api/bidder/library/category
router.post('/library/category', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { name, sort_order = 0 } = req.body;

    const result = await pool.query(
      'INSERT INTO bidder_categories (company_id, name, sort_order) VALUES ($1,$2,$3) RETURNING *',
      [companyId, name, sort_order]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /bidder/library/category error:', err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PUT /api/bidder/library/category/:id
router.put('/library/category/:id', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { name, sort_order, is_active } = req.body;

    const result = await pool.query(
      `UPDATE bidder_categories SET name = $1, sort_order = $2, is_active = $3
       WHERE id = $4 AND company_id = $5 RETURNING *`,
      [name, sort_order, is_active, req.params.id, companyId]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Category not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /bidder/library/category/:id error:', err);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/bidder/library/category/:id
router.delete('/library/category/:id', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const result = await pool.query(
      'DELETE FROM bidder_categories WHERE id = $1 AND company_id = $2 RETURNING id',
      [req.params.id, companyId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Category not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /bidder/library/category/:id error:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// POST /api/bidder/library/item
router.post('/library/item', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const {
      category_id, name, description, default_unit_price = 0,
      default_unit_label, is_included = false, show_quantity = false, sort_order = 0,
      supplier, kit_price, sqft_per_kit, is_system = false, component_ids = [],
      is_charge_only = false, color, sku, internal_name, internal_description,
    } = req.body;

    // Verify category belongs to this company
    const check = await pool.query(
      'SELECT id FROM bidder_categories WHERE id = $1 AND company_id = $2',
      [category_id, companyId]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Category not found' });

    const result = await pool.query(
      `INSERT INTO bidder_library_items (category_id, company_id, name, description, default_unit_price, default_unit_label, is_included, show_quantity, sort_order, supplier, kit_price, sqft_per_kit, is_system, is_charge_only, color, sku, internal_name, internal_description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [category_id, companyId, name, clean(description), default_unit_price, clean(default_unit_label), is_included, show_quantity, sort_order, clean(supplier), clean(kit_price) || null, clean(sqft_per_kit) || null, is_system, is_charge_only, clean(color) || null, is_charge_only ? null : (clean(sku) || null), clean(internal_name) || null, clean(internal_description) || null]
    );

    const newItem = result.rows[0];

    if (is_system && component_ids.length > 0) {
      for (let i = 0; i < component_ids.length; i++) {
        await pool.query(
          `INSERT INTO bidder_library_system_components (system_item_id, component_item_id, sort_order) VALUES ($1,$2,$3)`,
          [newItem.id, component_ids[i], i]
        );
      }
    }

    res.status(201).json({ ...newItem, components: [] });
  } catch (err) {
    console.error('POST /bidder/library/item error:', err);
    res.status(500).json({ error: 'Failed to create library item' });
  }
});

// PUT /api/bidder/library/item/:id
router.put('/library/item/:id', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const {
      category_id, name, description, default_unit_price,
      default_unit_label, is_included, show_quantity, is_active, sort_order,
      supplier, kit_price, sqft_per_kit, is_system, component_ids, is_charge_only, color, sku, internal_name, internal_description,
    } = req.body;

    const kp  = clean(kit_price)    != null ? parseFloat(clean(kit_price))    : null;
    const sfk = clean(sqft_per_kit) != null ? parseFloat(clean(sqft_per_kit)) : null;

    const result = await pool.query(
      `UPDATE bidder_library_items SET
        category_id = $1, name = $2, description = $3, default_unit_price = $4,
        default_unit_label = $5, is_included = $6, show_quantity = $7,
        is_active = $8, sort_order = $9, supplier = $10,
        is_charge_only = $13, color = $14, sku = $15, internal_name = $16, internal_description = $17,
        kit_price       = CASE WHEN source_supplier_product_id IS NULL THEN $11 ELSE kit_price END,
        sqft_per_kit    = CASE WHEN source_supplier_product_id IS NULL THEN $12 ELSE sqft_per_kit END,
        cost_override     = CASE WHEN source_supplier_product_id IS NOT NULL THEN $11 ELSE cost_override END,
        coverage_override = CASE WHEN source_supplier_product_id IS NOT NULL THEN $12 ELSE coverage_override END
       WHERE id = $18 AND company_id = $19 RETURNING *`,
      [
        category_id, name, clean(description), default_unit_price,
        clean(default_unit_label), is_included, show_quantity,
        is_active, sort_order, clean(supplier), kp, sfk,
        is_charge_only ?? false, clean(color) || null,
        (is_charge_only ?? false) ? null : (clean(sku) || null),
        clean(internal_name) || null,
        clean(internal_description) || null,
        req.params.id, companyId,
      ]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Library item not found' });
    const updated = result.rows[0];

    if (updated.is_system && Array.isArray(component_ids)) {
      await pool.query('DELETE FROM bidder_library_system_components WHERE system_item_id = $1', [updated.id]);
      for (let i = 0; i < component_ids.length; i++) {
        await pool.query(
          `INSERT INTO bidder_library_system_components (system_item_id, component_item_id, sort_order) VALUES ($1,$2,$3)`,
          [updated.id, component_ids[i], i]
        );
      }
    }

    res.json(updated);
  } catch (err) {
    console.error('PUT /bidder/library/item/:id error:', err);
    res.status(500).json({ error: 'Failed to update library item' });
  }
});

// DELETE /api/bidder/library/item/:id
router.delete('/library/item/:id', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const result = await pool.query(
      'DELETE FROM bidder_library_items WHERE id = $1 AND company_id = $2 RETURNING id',
      [req.params.id, companyId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Library item not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /bidder/library/item/:id error:', err);
    res.status(500).json({ error: 'Failed to delete library item' });
  }
});

// ============================================================================
// COMPANY SETTINGS
// ============================================================================

// GET /api/bidder/company-settings
router.get('/company-settings', async (req, res) => {
  try {
    const companyId = req.user.company_id;

    let result = await pool.query(
      `SELECT bcs.*,
              bpd.primary_color AS preferred_design_primary_color,
              bpd.accent_color  AS preferred_design_accent_color
       FROM bidder_company_settings bcs
       LEFT JOIN bidder_proposal_designs bpd ON bpd.id = bcs.preferred_proposal_design_id
       WHERE bcs.company_id = $1`,
      [companyId]
    );

    // Auto-create with defaults if not yet configured
    if (!result.rows.length) {
      result = await pool.query(
        `INSERT INTO bidder_company_settings (company_id, terms_and_conditions)
         VALUES ($1, $2) RETURNING *, NULL AS preferred_design_primary_color, NULL AS preferred_design_accent_color`,
        [companyId, DEFAULT_TERMS]
      );
    }

    const row = result.rows[0];
    // Never expose secret keys — send booleans so the UI knows if one is saved
    const { stripe_secret_key, paypal_secret_key, ...safeRow } = row;
    safeRow.stripe_secret_key_saved = !!stripe_secret_key;
    safeRow.paypal_secret_key_saved = !!paypal_secret_key;
    res.json(safeRow);
  } catch (err) {
    console.error('GET /bidder/company-settings error:', err);
    res.status(500).json({ error: 'Failed to fetch company settings' });
  }
});

// PUT /api/bidder/company-settings
router.put('/company-settings', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const {
      stripe_publishable_key, stripe_secret_key,
      paypal_client_id, paypal_secret_key, payment_processor,
      include_payment_button, down_payment_default_percent, convenience_fee_percent,
      preferred_proposal_design_id, terms_and_conditions, system_notes,
      email_from_name, email_from_email, notification_emails,
      proposal_top_text, invoice_top_text,
      proposal_domain, logo_url, default_warranty, primary_color, accent_color,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO bidder_company_settings
         (company_id, stripe_publishable_key, stripe_secret_key,
          paypal_client_id, paypal_secret_key, payment_processor,
          include_payment_button,
          down_payment_default_percent, convenience_fee_percent, preferred_proposal_design_id,
          terms_and_conditions, system_notes, email_from_name, email_from_email,
          notification_emails,
          proposal_top_text, invoice_top_text, proposal_domain, logo_url,
          default_warranty, primary_color, accent_color, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW())
       ON CONFLICT (company_id) DO UPDATE SET
         stripe_publishable_key = EXCLUDED.stripe_publishable_key,
         stripe_secret_key = COALESCE(EXCLUDED.stripe_secret_key, bidder_company_settings.stripe_secret_key),
         paypal_client_id = EXCLUDED.paypal_client_id,
         paypal_secret_key = COALESCE(EXCLUDED.paypal_secret_key, bidder_company_settings.paypal_secret_key),
         payment_processor = EXCLUDED.payment_processor,
         include_payment_button = EXCLUDED.include_payment_button,
         down_payment_default_percent = EXCLUDED.down_payment_default_percent,
         convenience_fee_percent = EXCLUDED.convenience_fee_percent,
         preferred_proposal_design_id = EXCLUDED.preferred_proposal_design_id,
         terms_and_conditions = EXCLUDED.terms_and_conditions,
         system_notes = EXCLUDED.system_notes,
         email_from_name = EXCLUDED.email_from_name,
         email_from_email = EXCLUDED.email_from_email,
         notification_emails = EXCLUDED.notification_emails,
         proposal_top_text = EXCLUDED.proposal_top_text,
         invoice_top_text = EXCLUDED.invoice_top_text,
         proposal_domain = EXCLUDED.proposal_domain,
         logo_url = EXCLUDED.logo_url,
         default_warranty = EXCLUDED.default_warranty,
         primary_color = EXCLUDED.primary_color,
         accent_color = EXCLUDED.accent_color,
         updated_at = NOW()
       RETURNING *`,
      [
        companyId, clean(stripe_publishable_key),
        stripe_secret_key ? stripe_secret_key.trim() : null,
        clean(paypal_client_id),
        paypal_secret_key ? paypal_secret_key.trim() : null,
        payment_processor || 'stripe',
        include_payment_button,
        down_payment_default_percent,
        parseFloat(convenience_fee_percent) || 0,
        clean(preferred_proposal_design_id),
        clean(terms_and_conditions), clean(system_notes),
        clean(email_from_name), clean(email_from_email),
        clean(notification_emails),
        clean(proposal_top_text), clean(invoice_top_text),
        clean(proposal_domain), clean(logo_url),
        clean(default_warranty), clean(primary_color), clean(accent_color),
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /bidder/company-settings error:', err);
    res.status(500).json({ error: 'Failed to update company settings' });
  }
});

// PUT /api/bidder/company-colors — save template selection + color overrides
router.put('/company-colors', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { primary_color, accent_color, preferred_proposal_design_id } = req.body;

    const result = await pool.query(
      `INSERT INTO bidder_company_settings (company_id, primary_color, accent_color, preferred_proposal_design_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (company_id) DO UPDATE SET
         primary_color                = EXCLUDED.primary_color,
         accent_color                 = EXCLUDED.accent_color,
         preferred_proposal_design_id = EXCLUDED.preferred_proposal_design_id
       RETURNING primary_color, accent_color, preferred_proposal_design_id`,
      [companyId, clean(primary_color), clean(accent_color), clean(preferred_proposal_design_id)]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /bidder/company-colors error:', err);
    res.status(500).json({ error: 'Failed to save design settings' });
  }
});

// POST /api/bidder/upload-logo — upload logo image to R2, return public URL
router.post('/upload-logo', logoUpload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const companyId = req.user.company_id || 'master';
    const ext = (req.file.mimetype.split('/')[1] || 'png').replace('jpeg', 'jpg');
    const key = `logos/${companyId}/${crypto.randomUUID()}.${ext}`;

    await r2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    res.json({ url: `${PUBLIC_URL}/${key}` });
  } catch (err) {
    console.error('POST /bidder/upload-logo error:', err);
    res.status(500).json({ error: 'Logo upload failed' });
  }
});

// ============================================================================
// PROPOSAL DESIGNS (master role only)
// ============================================================================

// GET /api/bidder/proposal-designs — master sees all; companies see public + their private
router.get('/proposal-designs', async (req, res) => {
  try {
    const isMaster = req.user?.role === 'master';
    const companyId = req.user?.company_id || null;
    let result;
    if (isMaster) {
      result = await pool.query('SELECT * FROM bidder_proposal_designs ORDER BY name');
    } else {
      result = await pool.query(
        `SELECT * FROM bidder_proposal_designs
         WHERE visibility = 'public'
            OR (visibility = 'private' AND private_company_id = $1)
         ORDER BY name`,
        [companyId]
      );
    }
    res.json(result.rows);
  } catch (err) {
    console.error('GET /bidder/proposal-designs error:', err);
    res.status(500).json({ error: 'Failed to fetch proposal designs' });
  }
});

// POST /api/bidder/proposal-designs — master only
router.post('/proposal-designs', requireRole('master'), async (req, res) => {
  try {
    const { name, description, template_content, primary_color = '#1c2333', accent_color = '#f97316', visibility = 'public', private_company_id = null } = req.body;
    const is_active = visibility !== 'inactive';

    const result = await pool.query(
      `INSERT INTO bidder_proposal_designs (name, description, template_content, is_active, primary_color, accent_color, visibility, private_company_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, clean(description), clean(template_content), is_active, primary_color, accent_color, visibility, private_company_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /bidder/proposal-designs error:', err);
    res.status(500).json({ error: 'Failed to create proposal design' });
  }
});

// PUT /api/bidder/proposal-designs/:id — master only
router.put('/proposal-designs/:id', requireRole('master'), async (req, res) => {
  try {
    const { name, description, template_content, primary_color = '#1c2333', accent_color = '#f97316', visibility = 'public', private_company_id = null } = req.body;
    const is_active = visibility !== 'inactive';

    const result = await pool.query(
      `UPDATE bidder_proposal_designs
       SET name = $1, description = $2, template_content = $3, is_active = $4,
           primary_color = $5, accent_color = $6, visibility = $7, private_company_id = $8
       WHERE id = $9 RETURNING *`,
      [name, clean(description), clean(template_content), is_active, primary_color, accent_color, visibility, private_company_id, req.params.id]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Design not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /bidder/proposal-designs/:id error:', err);
    res.status(500).json({ error: 'Failed to update proposal design' });
  }
});

// DELETE /api/bidder/proposal-designs/:id — master only
router.delete('/proposal-designs/:id', requireRole('master'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM bidder_proposal_designs WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Design not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /bidder/proposal-designs/:id error:', err);
    res.status(500).json({ error: 'Failed to delete proposal design' });
  }
});

// ============================================================================
// PAYMENT SCHEDULES
// ============================================================================

// POST /api/bidder/payment
router.post('/payment', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { proposal_id, description = 'Down Payment', amount_type = 'percent', amount_value = 50, amount_calculated = 0, sort_order = 0 } = req.body;

    const check = await pool.query(
      'SELECT id FROM bidder_proposals WHERE id = $1 AND ($2::integer IS NULL OR company_id = $2::integer)',
      [proposal_id, companyId]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Proposal not found' });

    const result = await pool.query(
      `INSERT INTO bidder_payment_schedules (proposal_id, description, amount_type, amount_value, amount_calculated, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [proposal_id, description, amount_type, amount_value, amount_calculated, sort_order]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /bidder/payment error:', err);
    res.status(500).json({ error: 'Failed to add payment' });
  }
});

// PUT /api/bidder/payment/:id
router.put('/payment/:id', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { description, amount_type, amount_value, amount_calculated, sort_order } = req.body;

    const result = await pool.query(
      `UPDATE bidder_payment_schedules ps
       SET description = $1, amount_type = $2, amount_value = $3, amount_calculated = $4, sort_order = $5
       FROM bidder_proposals p
       WHERE ps.id = $6 AND ps.proposal_id = p.id AND ($7::integer IS NULL OR p.company_id = $7::integer)
       RETURNING ps.*`,
      [description, amount_type, amount_value, amount_calculated, sort_order, req.params.id, companyId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Payment not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /bidder/payment/:id error:', err);
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

// DELETE /api/bidder/payment/:id
router.delete('/payment/:id', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const result = await pool.query(
      `DELETE FROM bidder_payment_schedules ps
       USING bidder_proposals p
       WHERE ps.id = $1 AND ps.proposal_id = p.id AND ($2::integer IS NULL OR p.company_id = $2::integer)
       RETURNING ps.id`,
      [req.params.id, companyId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Payment not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /bidder/payment/:id error:', err);
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

// ============================================================================
// WARRANTIES
// ============================================================================

// GET /api/bidder/warranties
router.get('/warranties', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const result = await pool.query(
      `SELECT id, internal_name, warranty_title, warranty_pdf_url, is_default, created_at
       FROM warranties WHERE company_id = $1
       ORDER BY is_default DESC, internal_name`,
      [companyId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /bidder/warranties error:', err);
    res.status(500).json({ error: 'Failed to fetch warranties' });
  }
});

// POST /api/bidder/warranties
router.post('/warranties', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { internal_name, warranty_title, warranty_pdf_url, is_default = false } = req.body;
    if (!internal_name || !warranty_title || !warranty_pdf_url) {
      return res.status(400).json({ error: 'internal_name, warranty_title, and warranty_pdf_url are required' });
    }
    const result = await pool.transaction(async (client) => {
      if (is_default) {
        await client.query('UPDATE warranties SET is_default = false WHERE company_id = $1', [companyId]);
      }
      return client.query(
        `INSERT INTO warranties (company_id, internal_name, warranty_title, warranty_pdf_url, is_default)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING id, internal_name, warranty_title, warranty_pdf_url, is_default, created_at`,
        [companyId, internal_name, warranty_title, warranty_pdf_url, is_default]
      );
    });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /bidder/warranties error:', err);
    res.status(500).json({ error: 'Failed to create warranty' });
  }
});

// PUT /api/bidder/warranties/:id
router.put('/warranties/:id', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { internal_name, warranty_title, warranty_pdf_url, is_default = false } = req.body;
    if (!internal_name || !warranty_title) {
      return res.status(400).json({ error: 'internal_name and warranty_title are required' });
    }
    const result = await pool.transaction(async (client) => {
      if (is_default) {
        await client.query(
          'UPDATE warranties SET is_default = false WHERE company_id = $1 AND id != $2',
          [companyId, req.params.id]
        );
      }
      return client.query(
        `UPDATE warranties SET
          internal_name = $1, warranty_title = $2,
          warranty_pdf_url = COALESCE($3, warranty_pdf_url),
          is_default = $4, updated_at = NOW()
         WHERE id = $5 AND company_id = $6
         RETURNING id, internal_name, warranty_title, warranty_pdf_url, is_default, created_at`,
        [internal_name, warranty_title, warranty_pdf_url || null, is_default, req.params.id, companyId]
      );
    });
    if (!result.rows.length) return res.status(404).json({ error: 'Warranty not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /bidder/warranties/:id error:', err);
    res.status(500).json({ error: 'Failed to update warranty' });
  }
});

// DELETE /api/bidder/warranties/:id
router.delete('/warranties/:id', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const result = await pool.query(
      'DELETE FROM warranties WHERE id = $1 AND company_id = $2 RETURNING id',
      [req.params.id, companyId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Warranty not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /bidder/warranties/:id error:', err);
    res.status(500).json({ error: 'Failed to delete warranty' });
  }
});

// POST /api/bidder/proposal/:id/send-warranty-email
router.post('/proposal/:id/send-warranty-email', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const row = (await pool.query(
      `SELECT bp.warranty_id,
              l.email as lead_email, l.full_name as lead_name, l.name as lead_name_short,
              c.ghl_company_from_name, c.name as company_db_name, c.phone as company_phone,
              bcs.email_from_name, bcs.email_from_email, bcs.logo_url,
              bp.proposal_design_id, bcs.preferred_proposal_design_id,
              COALESCE(bcs.primary_color, bpd_prop.primary_color, bpd_pref.primary_color) AS design_primary_color,
              COALESCE(bcs.accent_color,  bpd_prop.accent_color,  bpd_pref.accent_color)  AS design_accent_color
       FROM bidder_proposals bp
       JOIN leads l ON bp.lead_id = l.id
       JOIN companies c ON bp.company_id = c.id
       LEFT JOIN bidder_company_settings bcs ON bcs.company_id = bp.company_id
       LEFT JOIN bidder_proposal_designs bpd_prop ON bpd_prop.id = bp.proposal_design_id
       LEFT JOIN bidder_proposal_designs bpd_pref ON bpd_pref.id = bcs.preferred_proposal_design_id
       WHERE bp.id = $1 AND ($2::integer IS NULL OR bp.company_id = $2::integer)`,
      [req.params.id, companyId]
    )).rows[0];

    if (!row) return res.status(404).json({ error: 'Proposal not found' });
    if (!row.warranty_id) return res.status(400).json({ error: 'No warranty attached to this proposal' });

    const toEmail = req.body.email || row.lead_email;
    if (!toEmail) return res.status(400).json({ error: 'No email address provided' });

    const warranty = (await pool.query(
      'SELECT warranty_title, warranty_pdf_url FROM warranties WHERE id = $1',
      [row.warranty_id]
    )).rows[0];
    if (!warranty) return res.status(404).json({ error: 'Warranty record not found' });

    const companyName   = row.ghl_company_from_name || row.company_db_name || '';
    const customerName  = row.lead_name || row.lead_name_short || '';
    const primaryColor  = row.design_primary_color || null;
    const accentColor   = row.design_accent_color  || null;

    await sendWarrantyEmail({
      toEmail,
      customerName,
      companyName,
      warrantyTitle:      warranty.warranty_title,
      warrantyPdfDataUrl: warranty.warranty_pdf_url,
      fromName:           row.email_from_name  || companyName || undefined,
      fromEmail:          row.email_from_email || undefined,
      primaryColor,
      accentColor,
      logoUrl:            row.logo_url       || null,
      companyPhone:       row.company_phone  || null,
    });

    res.json({ success: true, sentTo: toEmail });
  } catch (err) {
    console.error('POST /bidder/proposal/:id/send-warranty-email error:', err);
    res.status(500).json({ error: 'Failed to send warranty email' });
  }
});

// ============================================================================
// PUBLIC PROPOSAL (web proposal page — Phase 7)
// ============================================================================

// GET /api/bidder/public/:id — get proposal for public web page
router.get('/public/:id', async (req, res) => {
  try {
    const proposalResult = await pool.query(
      `SELECT bp.*, COALESCE(c.company_name, c.name) as company_name_db,
              c.phone as company_phone_db, c.email as company_email_db,
              c.address as company_address_db, c.city as company_city_db,
              c.state as company_state_db, c.zip as company_zip_db,
              c.website as company_website_db,
              c.ghl_company_name, c.ghl_company_from_name, c.ghl_company_from_email,
              c.ghl_company_phone, c.ghl_company_website,
              c.ghl_company_street_address, c.ghl_company_city,
              c.ghl_company_state, c.ghl_company_zip,
              bcs.terms_and_conditions, bcs.system_notes,
              bcs.include_payment_button as company_include_payment_button,
              bcs.stripe_publishable_key as company_stripe_publishable_key,
              bcs.paypal_client_id as company_paypal_client_id,
              bcs.payment_processor as company_payment_processor,
              bcs.convenience_fee_percent as company_convenience_fee_percent,
              bcs.preferred_proposal_design_id, bcs.logo_url,
              u.name AS created_by_name,
              COALESCE(bcs.primary_color, bpd_prop.primary_color, bpd_pref.primary_color) AS design_primary_color,
              COALESCE(bcs.accent_color,  bpd_prop.accent_color,  bpd_pref.accent_color)  AS design_accent_color,
              w.warranty_title
       FROM bidder_proposals bp
       JOIN companies c ON bp.company_id = c.id
       LEFT JOIN bidder_company_settings bcs ON bcs.company_id = c.id
       LEFT JOIN users u ON bp.created_by_user_id = u.id
       LEFT JOIN bidder_proposal_designs bpd_prop ON bpd_prop.id = bp.proposal_design_id
       LEFT JOIN bidder_proposal_designs bpd_pref ON bpd_pref.id = bcs.preferred_proposal_design_id
       LEFT JOIN warranties w ON w.id = bp.warranty_id
       WHERE bp.doc_number = $1`,
      [parseInt(req.params.id, 10)]
    );

    if (!proposalResult.rows.length) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const proposal = proposalResult.rows[0];

    // Fetch lead info (name/address for proposal header)
    const leadResult = await pool.query(
      'SELECT full_name, name, address, city, state, zip, email, phone FROM leads WHERE id = $1',
      [proposal.lead_id]
    );

    const [items, customItems, discounts, paymentSchedules] = await Promise.all([
      pool.query('SELECT * FROM bidder_proposal_items WHERE proposal_id = $1 ORDER BY sort_order, id', [proposal.id]),
      pool.query('SELECT * FROM bidder_custom_items WHERE proposal_id = $1 ORDER BY sort_order, id', [proposal.id]),
      pool.query('SELECT * FROM bidder_discounts WHERE proposal_id = $1 ORDER BY sort_order, id', [proposal.id]),
      pool.query('SELECT * FROM bidder_payment_schedules WHERE proposal_id = $1 ORDER BY sort_order, id', [proposal.id]),
    ]);

    res.json({
      proposal,
      lead: leadResult.rows[0] || null,
      items: items.rows,
      customItems: customItems.rows,
      discounts: discounts.rows,
      paymentSchedules: paymentSchedules.rows,
    });
  } catch (err) {
    console.error('GET /bidder/public/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch proposal' });
  }
});

// POST /api/bidder/proposal/:id/send-email — send proposal link to customer
router.post('/proposal/:id/send-email', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const result = await pool.query(
      `SELECT bp.bid_name, bp.bid_total, bp.company_id,
              bp.proposal_design_id, bp.doc_number,
              l.email as lead_email, l.full_name as lead_name, l.name as lead_name_short,
              c.ghl_company_from_name, c.name as company_db_name, c.phone as company_phone,
              bcs.email_from_name, bcs.email_from_email, bcs.proposal_domain, bcs.logo_url,
              bcs.preferred_proposal_design_id,
              COALESCE(bcs.primary_color, bpd_prop.primary_color, bpd_pref.primary_color) AS design_primary_color,
              COALESCE(bcs.accent_color,  bpd_prop.accent_color,  bpd_pref.accent_color)  AS design_accent_color
       FROM bidder_proposals bp
       JOIN leads l ON bp.lead_id = l.id
       JOIN companies c ON bp.company_id = c.id
       LEFT JOIN bidder_company_settings bcs ON bcs.company_id = bp.company_id
       LEFT JOIN bidder_proposal_designs bpd_prop ON bpd_prop.id = bp.proposal_design_id
       LEFT JOIN bidder_proposal_designs bpd_pref ON bpd_pref.id = bcs.preferred_proposal_design_id
       WHERE bp.id = $1 AND ($2::integer IS NULL OR bp.company_id = $2::integer)`,
      [req.params.id, companyId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Proposal not found' });

    const row = result.rows[0];
    const toEmail = req.body.email || row.lead_email;
    if (!toEmail) return res.status(400).json({ error: 'No email address on file for this customer' });

    const companyName  = row.ghl_company_from_name || row.company_db_name || '';
    const customerName = row.lead_name || row.lead_name_short || '';
    const emailType    = req.body.type || 'proposal';
    const invoiceNum   = req.body.invoice_num ? String(req.body.invoice_num) : null;
    const baseUrl      = row.proposal_domain
      ? `https://${row.proposal_domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
      : process.env.APP_URL;
    const dn           = row.doc_number || docNum(parseInt(req.params.id, 10));
    const proposalUrl  = emailType === 'invoice'
      ? `${baseUrl}/invoice/${dn}${invoiceNum ? `/${invoiceNum}` : ''}`
      : `${baseUrl}/proposal/${dn}`;
    const fromName     = row.email_from_name || companyName || undefined;
    const fromEmail    = row.email_from_email || undefined;
    const primaryColor = row.design_primary_color || null;
    const accentColor  = row.design_accent_color  || null;
    const logoUrl      = row.logo_url || null;
    const companyPhone = row.company_phone || null;

    // For invoice emails, fetch the specific payment schedule entry
    let invoiceLabel = null;
    let payDescription = null;
    let payAmountStr = null;
    if (emailType === 'invoice' && invoiceNum) {
      const schedResult = await pool.query(
        'SELECT * FROM bidder_payment_schedules WHERE proposal_id = $1 ORDER BY sort_order, id',
        [req.params.id]
      );
      const schedules = schedResult.rows;
      const total = schedules.length;
      const idx      = Math.max(0, parseInt(invoiceNum, 10) - 1);
      const suffix   = String(idx + 1);
      const entry    = idx < total ? schedules[idx] : null;
      const bidTotal = parseFloat(row.bid_total) || 0;
      let payAmt;
      if (entry) {
        payAmt = entry.amount_type === 'dollar'
          ? parseFloat(entry.amount_value) || 0
          : bidTotal * ((parseFloat(entry.amount_value) || 0) / 100);
      } else {
        // Balance invoice — amount is bid total minus all scheduled payments
        const payTotal = schedules.reduce((a, s) => {
          const v = parseFloat(s.amount_value) || 0;
          return a + (s.amount_type === 'dollar' ? v : bidTotal * v / 100);
        }, 0);
        payAmt = Math.max(0, bidTotal - payTotal);
      }
      invoiceLabel   = `INV-${dn}-${suffix}`;
      payDescription = entry?.description || (idx >= total ? 'Balance Due' : null);
      payAmountStr   = `$${payAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    await sendProposalLinkEmail({
      toEmail,
      customerName,
      companyName,
      bidName:      row.bid_name,
      bidTotal:     row.bid_total,
      proposalUrl,
      fromName,
      fromEmail,
      emailType,
      primaryColor,
      accentColor,
      logoUrl,
      companyPhone,
      invoiceLabel,
      payDescription,
      payAmountStr,
    });

    res.json({ success: true, sentTo: toEmail });
  } catch (err) {
    console.error('POST /bidder/proposal/:id/send-email error:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// POST /api/bidder/public/:id/accept — customer signs proposal
router.post('/public/:id/accept', async (req, res) => {
  try {
    const { signature_name } = req.body;
    if (!signature_name || !signature_name.trim()) {
      return res.status(400).json({ error: 'Signature name is required' });
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
    const signedAt = new Date();

    // Check proposal exists and isn't already signed
    const existing = await pool.query(
      `SELECT bp.*, bp.doc_number,
              l.email as lead_email, l.full_name as lead_name, l.name as lead_name_short,
              c.ghl_company_from_name, c.company_name as company_db_name, c.phone as company_phone,
              bcs.email_from_name, bcs.email_from_email, bcs.notification_emails, bcs.proposal_domain,
              bcs.logo_url, bcs.preferred_proposal_design_id,
              COALESCE(bcs.primary_color, bpd_prop.primary_color, bpd_pref.primary_color) AS design_primary_color,
              COALESCE(bcs.accent_color,  bpd_prop.accent_color,  bpd_pref.accent_color)  AS design_accent_color
       FROM bidder_proposals bp
       JOIN leads l ON bp.lead_id = l.id
       JOIN companies c ON bp.company_id = c.id
       LEFT JOIN bidder_company_settings bcs ON bcs.company_id = c.id
       LEFT JOIN bidder_proposal_designs bpd_prop ON bpd_prop.id = bp.proposal_design_id
       LEFT JOIN bidder_proposal_designs bpd_pref ON bpd_pref.id = bcs.preferred_proposal_design_id
       WHERE bp.doc_number = $1`,
      [parseInt(req.params.id, 10)]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Proposal not found' });

    const proposal = existing.rows[0];
    if (proposal.signed_at) {
      return res.status(409).json({ error: 'This proposal has already been signed' });
    }

    // Save signature, auto-accept, and stamp accepted_date if not already set
    await pool.query(
      `UPDATE bidder_proposals
       SET signature_name = $1, signed_at = $2, signature_ip = $3,
           status = 'accepted', accepted_date = COALESCE(accepted_date, $5)
       WHERE id = $4`,
      [signature_name.trim(), signedAt, ip, proposal.id, signedAt]
    );

    const contractorEmail = proposal.notification_emails ? proposal.notification_emails.trim() : null;
    const companyName = proposal.ghl_company_from_name || proposal.company_db_name || '';
    const customerEmail = proposal.lead_email || null;
    const customerName = proposal.lead_name || proposal.lead_name_short || '';
    const _signBaseUrl = proposal.proposal_domain
      ? `https://${proposal.proposal_domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
      : process.env.APP_URL;
    const proposalUrl = `${_signBaseUrl}/proposal/${req.params.id}`;

    // Send emails (non-blocking — don't fail the request if email fails)
    sendProposalAcceptedEmails({
      proposalId: req.params.id,
      proposalDocNum: proposal.doc_number,
      bidName: proposal.bid_name,
      bidTotal: proposal.bid_total || null,
      signatureName: signature_name.trim(),
      signedAt,
      customerEmail,
      customerName,
      contractorEmail,
      companyName,
      proposalUrl,
      fromName: proposal.email_from_name || null,
      fromEmail: proposal.email_from_email || null,
      primaryColor:  proposal.design_primary_color || null,
      accentColor:   proposal.design_accent_color  || null,
      logoUrl:       proposal.logo_url             || null,
      companyPhone:  proposal.company_phone        || null,
    }).catch(err => console.error('Proposal accept email error:', err));

    res.json({ success: true, signed_at: signedAt });
  } catch (err) {
    console.error('POST /bidder/public/:id/accept error:', err);
    res.status(500).json({ error: 'Failed to record signature' });
  }
});

// POST /api/bidder/public/:id/stripe-checkout — create Stripe Checkout Session for a proposal
router.post('/public/:id/stripe-checkout', async (req, res) => {
  try {
    const { base_amount_cents, convenience_fee_percent = 0, success_url, cancel_url } = req.body;
    if (!base_amount_cents || base_amount_cents <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const result = await pool.query(
      `SELECT bcs.stripe_secret_key, bcs.proposal_domain,
              bp.bid_name,
              COALESCE(c.company_name, c.name) AS company_name,
              c.address AS company_address,
              c.city    AS company_city,
              c.state   AS company_state,
              c.zip     AS company_zip,
              c.phone   AS company_phone
       FROM bidder_proposals bp
       JOIN bidder_company_settings bcs ON bcs.company_id = bp.company_id
       JOIN companies c ON c.id = bp.company_id
       WHERE bp.doc_number = $1`,
      [parseInt(req.params.id, 10)]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Proposal not found' });
    const { stripe_secret_key, proposal_domain, bid_name, company_name, company_address, company_city, company_state, company_zip, company_phone } = result.rows[0];
    if (!stripe_secret_key) return res.status(400).json({ error: 'Stripe is not configured for this account' });

    const _stripeBaseUrl = proposal_domain
      ? `https://${proposal_domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
      : process.env.APP_URL;

    const feePercent = parseFloat(convenience_fee_percent) || 0;
    const feeCents   = Math.round(base_amount_cents * feePercent / 100);
    const baseCents  = Math.round(base_amount_cents);

    // Build company address description shown on the Stripe page
    const addressLine = [company_address, company_city, company_state, company_zip].filter(Boolean).join(', ');
    const productDescription = [addressLine, company_phone].filter(Boolean).join(' · ') || undefined;

    const lineItems = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: bid_name || 'Proposal Payment',
            ...(productDescription ? { description: productDescription } : {}),
          },
          unit_amount: baseCents,
        },
        quantity: 1,
      },
    ];

    if (feeCents > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: `Online Payment Convenience Fee (${feePercent}%)` },
          unit_amount: feeCents,
        },
        quantity: 1,
      });
    }

    const stripe = Stripe(stripe_secret_key);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: success_url || `${_stripeBaseUrl}/proposal/${req.params.id}?payment=success`,
      cancel_url:  cancel_url  || `${_stripeBaseUrl}/proposal/${req.params.id}`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('POST /bidder/public/:id/stripe-checkout error:', err);
    res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
});

// POST /api/bidder/public/:id/paypal-checkout — create PayPal order for a proposal
router.post('/public/:id/paypal-checkout', async (req, res) => {
  try {
    const { base_amount_cents, convenience_fee_percent = 0, success_url, cancel_url } = req.body;
    if (!base_amount_cents || base_amount_cents <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const result = await pool.query(
      `SELECT bcs.paypal_client_id, bcs.paypal_secret_key, bcs.proposal_domain,
              bp.bid_name,
              COALESCE(c.company_name, c.name) AS company_name
       FROM bidder_proposals bp
       JOIN bidder_company_settings bcs ON bcs.company_id = bp.company_id
       JOIN companies c ON c.id = bp.company_id
       WHERE bp.doc_number = $1`,
      [parseInt(req.params.id, 10)]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Proposal not found' });
    const { paypal_client_id, paypal_secret_key, proposal_domain, bid_name, company_name } = result.rows[0];
    if (!paypal_client_id || !paypal_secret_key) {
      return res.status(400).json({ error: 'PayPal is not configured for this account' });
    }

    const _baseUrl = proposal_domain
      ? `https://${proposal_domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
      : process.env.APP_URL;

    const feePercent = parseFloat(convenience_fee_percent) || 0;
    const feeCents   = Math.round(base_amount_cents * feePercent / 100);
    const totalCents = Math.round(base_amount_cents) + feeCents;
    const totalDollars = (totalCents / 100).toFixed(2);

    const accessToken = await getPayPalAccessToken(paypal_client_id, paypal_secret_key);

    const orderBody = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          description: bid_name || 'Proposal Payment',
          amount: {
            currency_code: 'USD',
            value: totalDollars,
          },
        },
      ],
      application_context: {
        brand_name: company_name || 'Payment',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: success_url || `${_baseUrl}/proposal/${req.params.id}?payment=success`,
        cancel_url: cancel_url || `${_baseUrl}/proposal/${req.params.id}`,
      },
    };

    const orderRes = await axios.post(
      `${PAYPAL_BASE}/v2/checkout/orders`,
      orderBody,
      { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
    );

    const approvalLink = orderRes.data.links.find(l => l.rel === 'approve');
    if (!approvalLink) return res.status(500).json({ error: 'PayPal did not return an approval URL' });

    res.json({ url: approvalLink.href });
  } catch (err) {
    console.error('POST /bidder/public/:id/paypal-checkout error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.message || err.message || 'Failed to create PayPal order' });
  }
});

// POST /api/bidder/public/:id/paypal-capture — capture a PayPal order after customer approval
router.post('/public/:id/paypal-capture', async (req, res) => {
  try {
    const { order_id } = req.body;
    if (!order_id) return res.status(400).json({ error: 'Missing order_id' });

    const result = await pool.query(
      `SELECT bcs.paypal_client_id, bcs.paypal_secret_key
       FROM bidder_proposals bp
       JOIN bidder_company_settings bcs ON bcs.company_id = bp.company_id
       WHERE bp.doc_number = $1`,
      [parseInt(req.params.id, 10)]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Proposal not found' });
    const { paypal_client_id, paypal_secret_key } = result.rows[0];
    if (!paypal_client_id || !paypal_secret_key) {
      return res.status(400).json({ error: 'PayPal is not configured for this account' });
    }

    const accessToken = await getPayPalAccessToken(paypal_client_id, paypal_secret_key);

    const captureRes = await axios.post(
      `${PAYPAL_BASE}/v2/checkout/orders/${order_id}/capture`,
      {},
      { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
    );

    res.json({ success: true, status: captureRes.data.status });
  } catch (err) {
    // INSTRUMENT_DECLINED or ORDER_ALREADY_CAPTURED are not server errors
    const ppCode = err.response?.data?.details?.[0]?.issue;
    if (ppCode === 'ORDER_ALREADY_CAPTURED') {
      return res.json({ success: true, status: 'COMPLETED' });
    }
    console.error('POST /bidder/public/:id/paypal-capture error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.message || err.message || 'Failed to capture PayPal order' });
  }
});

// POST /api/bidder/public/:id/payment-received — called from payment success page; sends confirmation emails
router.post('/public/:id/payment-received', async (req, res) => {
  try {
    const { amount_cents = 0, pay_label = 'Payment', invoice_num = '1' } = req.body;
    const amountStr = `$${(amount_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const result = await pool.query(
      `SELECT bp.id, bp.bid_name, bp.company_id, bp.proposal_design_id,
              l.email as lead_email, l.full_name as lead_name, l.name as lead_name_short,
              COALESCE(c.company_name, c.name) as company_db_name,
              c.ghl_company_from_name, c.phone as company_phone,
              bcs.email_from_name, bcs.email_from_email, bcs.notification_emails, bcs.proposal_domain, bcs.logo_url,
              bcs.preferred_proposal_design_id,
              COALESCE(bcs.primary_color, bpd_prop.primary_color, bpd_pref.primary_color) AS design_primary_color,
              COALESCE(bcs.accent_color,  bpd_prop.accent_color,  bpd_pref.accent_color)  AS design_accent_color
       FROM bidder_proposals bp
       JOIN leads l ON bp.lead_id = l.id
       JOIN companies c ON bp.company_id = c.id
       LEFT JOIN bidder_company_settings bcs ON bcs.company_id = c.id
       LEFT JOIN bidder_proposal_designs bpd_prop ON bpd_prop.id = bp.proposal_design_id
       LEFT JOIN bidder_proposal_designs bpd_pref ON bpd_pref.id = bcs.preferred_proposal_design_id
       WHERE bp.doc_number = $1`,
      [parseInt(req.params.id, 10)]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Proposal not found' });

    const proposalId = result.rows[0].id;

    // Stamp paid_at on first payment; append invoice_num to paid_invoice_nums
    await pool.query(
      `UPDATE bidder_proposals
       SET paid_at = COALESCE(paid_at, NOW()),
           paid_invoice_nums = CASE
             WHEN paid_invoice_nums = '' OR paid_invoice_nums IS NULL THEN $2
             WHEN paid_invoice_nums NOT LIKE '%' || $2 || '%' THEN paid_invoice_nums || ',' || $2
             ELSE paid_invoice_nums
           END
       WHERE id = $1`,
      [proposalId, String(invoice_num)]
    );

    // Check if all invoices are now paid → stamp final_paid_at
    const [scheduleRes, propRes] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM bidder_payment_schedules WHERE proposal_id = $1', [proposalId]),
      pool.query('SELECT paid_invoice_nums, balance_due FROM bidder_proposals WHERE id = $1', [proposalId]),
    ]);
    const scheduleCount = parseInt(scheduleRes.rows[0].count, 10);
    const balanceDue = parseFloat(propRes.rows[0].balance_due) || 0;
    const totalExpected = scheduleCount + (balanceDue > 0.009 ? 1 : 0);
    const paidNums = (propRes.rows[0].paid_invoice_nums || '').split(',').map(s => s.trim()).filter(Boolean);
    if (totalExpected > 0 && paidNums.length >= totalExpected) {
      await pool.query(
        'UPDATE bidder_proposals SET final_paid_at = COALESCE(final_paid_at, NOW()) WHERE id = $1',
        [proposalId]
      );
    }

    const row = result.rows[0];
    const companyName   = row.ghl_company_from_name || row.company_db_name || '';
    const customerEmail = row.lead_email || null;
    const customerName  = row.lead_name || row.lead_name_short || '';
    const baseUrl       = row.proposal_domain
      ? `https://${row.proposal_domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
      : process.env.APP_URL;
    const invoiceUrl    = `${baseUrl}/invoice/${req.params.id}/${String(invoice_num)}`;

    const contractorEmail = row.notification_emails ? row.notification_emails.trim() : null;

    const primaryColor = row.design_primary_color || null;
    const accentColor  = row.design_accent_color  || null;

    sendPaymentReceivedEmail({
      contractorEmail,
      customerEmail,
      customerName,
      companyName,
      bidName:    row.bid_name,
      amountStr,
      payLabel:   pay_label,
      invoiceUrl,
      fromName:   row.email_from_name  || null,
      fromEmail:  row.email_from_email || null,
      primaryColor,
      accentColor,
      logoUrl:       row.logo_url       || null,
      companyPhone:  row.company_phone  || null,
    }).catch(err => console.error('Payment received email error:', err));

    res.json({ success: true });
  } catch (err) {
    console.error('POST /bidder/public/:id/payment-received error:', err);
    res.status(500).json({ error: 'Failed to send payment notification' });
  }
});

// POST /api/bidder/public/:id/send-warranty-email — no auth required
router.post('/public/:id/send-warranty-email', async (req, res) => {
  try {
    const row = (await pool.query(
      `SELECT bp.warranty_id,
              l.email as lead_email, l.full_name as lead_name, l.name as lead_name_short,
              c.ghl_company_from_name, c.name as company_db_name, c.phone as company_phone,
              bcs.email_from_name, bcs.email_from_email, bcs.logo_url,
              bp.proposal_design_id, bcs.preferred_proposal_design_id,
              COALESCE(bcs.primary_color, bpd_prop.primary_color, bpd_pref.primary_color) AS design_primary_color,
              COALESCE(bcs.accent_color,  bpd_prop.accent_color,  bpd_pref.accent_color)  AS design_accent_color
       FROM bidder_proposals bp
       JOIN leads l ON bp.lead_id = l.id
       JOIN companies c ON bp.company_id = c.id
       LEFT JOIN bidder_company_settings bcs ON bcs.company_id = c.id
       LEFT JOIN bidder_proposal_designs bpd_prop ON bpd_prop.id = bp.proposal_design_id
       LEFT JOIN bidder_proposal_designs bpd_pref ON bpd_pref.id = bcs.preferred_proposal_design_id
       WHERE bp.doc_number = $1`,
      [parseInt(req.params.id, 10)]
    )).rows[0];

    if (!row) return res.status(404).json({ error: 'Proposal not found' });
    if (!row.warranty_id) return res.status(400).json({ error: 'No warranty attached to this proposal' });

    const toEmail = req.body.email || row.lead_email;
    if (!toEmail) return res.status(400).json({ error: 'No email address provided' });

    const warranty = (await pool.query(
      'SELECT warranty_title, warranty_pdf_url FROM warranties WHERE id = $1',
      [row.warranty_id]
    )).rows[0];
    if (!warranty) return res.status(404).json({ error: 'Warranty record not found' });

    const companyName   = row.ghl_company_from_name || row.company_db_name || '';
    const customerName  = row.lead_name || row.lead_name_short || '';
    const primaryColor  = row.design_primary_color || null;
    const accentColor   = row.design_accent_color  || null;

    await sendWarrantyEmail({
      toEmail,
      customerName,
      companyName,
      warrantyTitle:      warranty.warranty_title,
      warrantyPdfDataUrl: warranty.warranty_pdf_url,
      fromName:           row.email_from_name  || companyName || undefined,
      fromEmail:          row.email_from_email || undefined,
      primaryColor,
      accentColor,
      logoUrl:       row.logo_url      || null,
      companyPhone:  row.company_phone || null,
    });

    res.json({ success: true, sentTo: toEmail });
  } catch (err) {
    console.error('POST /bidder/public/:id/send-warranty-email error:', err);
    res.status(500).json({ error: 'Failed to send warranty email' });
  }
});

// ============================================================================
// COMPANY SUPPLIER ACCESS (master-only)
// ============================================================================

// GET /api/bidder/company-suppliers?company_id=X — returns array of enabled supplier IDs
router.get('/company-suppliers', requireRole('master'), async (req, res) => {
  try {
    const companyId = req.query.company_id;
    if (!companyId) return res.status(400).json({ error: 'company_id required' });
    const { rows } = await pool.query(
      'SELECT supplier_id FROM company_supplier_access WHERE company_id = $1',
      [companyId]
    );
    res.json(rows.map((r) => r.supplier_id));
  } catch (err) {
    console.error('GET /bidder/company-suppliers error:', err);
    res.status(500).json({ error: 'Failed to load supplier access' });
  }
});

// PUT /api/bidder/company-suppliers?company_id=X — body: { supplier_ids: [1,2,3] }
// On enable: copies supplier products into the company's real bidder library (editable).
// On disable: removes access record only — company keeps any items already copied.
router.put('/company-suppliers', requireRole('master'), async (req, res) => {
  try {
    const companyId = parseInt(req.query.company_id, 10);
    if (!companyId) return res.status(400).json({ error: 'company_id required' });
    const { supplier_ids = [] } = req.body;

    // Fetch which suppliers were already enabled (to find newly added ones)
    const existing = await pool.query(
      'SELECT supplier_id FROM company_supplier_access WHERE company_id = $1',
      [companyId]
    );
    const existingIds = new Set(existing.rows.map((r) => r.supplier_id));
    const newlyEnabled = supplier_ids.filter((sid) => !existingIds.has(sid));

    await pool.transaction(async (client) => {
      // Replace access records
      await client.query('DELETE FROM company_supplier_access WHERE company_id = $1', [companyId]);
      for (const sid of supplier_ids) {
        await client.query(
          'INSERT INTO company_supplier_access (company_id, supplier_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [companyId, sid]
        );
      }

      // For each newly enabled supplier, copy products into the company's real library
      for (const sid of newlyEnabled) {
        // Skip if category already exists for this supplier (re-enable after disable)
        const existingCat = await client.query(
          'SELECT id FROM bidder_categories WHERE company_id = $1 AND source_supplier_id = $2',
          [companyId, sid]
        );
        if (existingCat.rows.length > 0) continue;

        // Get supplier info + products
        const supplier = (await client.query('SELECT * FROM global_suppliers WHERE id = $1', [sid])).rows[0];
        if (!supplier) continue;
        const products = (await client.query(
          'SELECT * FROM global_supplier_products WHERE supplier_id = $1 AND is_active = true ORDER BY sort_order, name',
          [sid]
        )).rows;

        // Create category in company's library
        const catSortOrder = (await client.query(
          'SELECT COUNT(*) FROM bidder_categories WHERE company_id = $1', [companyId]
        )).rows[0].count;
        const cat = (await client.query(
          'INSERT INTO bidder_categories (company_id, name, sort_order, source_supplier_id) VALUES ($1,$2,$3,$4) RETURNING id',
          [companyId, supplier.name, catSortOrder, sid]
        )).rows[0];

        // Copy regular (non-system) products first so systems can reference them
        const regularProducts = products.filter((p) => !p.is_system);
        const systemProducts  = products.filter((p) => p.is_system);
        const globalIdToLibItemId = {};

        for (let i = 0; i < regularProducts.length; i++) {
          const p = regularProducts[i];
          const ins = await client.query(
            `INSERT INTO bidder_library_items
               (category_id, company_id, name, description, default_unit_price, default_unit_label,
                color, sku, kit_price, sqft_per_kit, is_charge_only, sort_order, source_supplier_product_id,
                internal_name, internal_description)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
            [cat.id, companyId, p.name, p.description, p.default_unit_price, p.default_unit_label,
             p.color, p.sku, p.kit_price, p.sqft_per_kit, p.is_charge_only, i, p.id,
             p.internal_name || null, p.internal_description || null]
          );
          globalIdToLibItemId[p.id] = ins.rows[0].id;
        }

        // Now copy system products and wire their components
        for (let i = 0; i < systemProducts.length; i++) {
          const p = systemProducts[i];
          const components = (await client.query(
            'SELECT component_product_id, sort_order FROM global_supplier_system_components WHERE system_product_id = $1 ORDER BY sort_order',
            [p.id]
          )).rows;

          const sysItem = (await client.query(
            `INSERT INTO bidder_library_items
               (category_id, company_id, name, description, default_unit_price, default_unit_label,
                color, sku, is_system, sort_order, source_supplier_product_id, internal_name, internal_description)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10,$11,$12) RETURNING id`,
            [cat.id, companyId, p.name, p.description, p.default_unit_price, p.default_unit_label,
             p.color, p.sku, regularProducts.length + i, p.id,
             p.internal_name || null, p.internal_description || null]
          )).rows[0];

          for (let ci = 0; ci < components.length; ci++) {
            const libCompId = globalIdToLibItemId[components[ci].component_product_id];
            if (libCompId) {
              await client.query(
                'INSERT INTO bidder_library_system_components (system_item_id, component_item_id, sort_order) VALUES ($1,$2,$3)',
                [sysItem.id, libCompId, ci]
              );
            }
          }
        }
      }
    });

    res.json({ success: true, enabled: supplier_ids.length });
  } catch (err) {
    console.error('PUT /bidder/company-suppliers error:', err);
    res.status(500).json({ error: 'Failed to update supplier access' });
  }
});

// ============================================================================
// GLOBAL SUPPLIERS (master-only)
// ============================================================================

// GET /api/bidder/global-suppliers
router.get('/global-suppliers', requireRole('master'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM global_suppliers ORDER BY sort_order, name'
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /bidder/global-suppliers error:', err);
    res.status(500).json({ error: 'Failed to load suppliers' });
  }
});

// POST /api/bidder/global-suppliers
router.post('/global-suppliers', requireRole('master'), async (req, res) => {
  try {
    const { name, notes = null, sort_order = 0 } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const { rows } = await pool.query(
      'INSERT INTO global_suppliers (name, notes, sort_order) VALUES ($1,$2,$3) RETURNING *',
      [name.trim(), notes, sort_order]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /bidder/global-suppliers error:', err);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

// PUT /api/bidder/global-suppliers/:id
router.put('/global-suppliers/:id', requireRole('master'), async (req, res) => {
  try {
    const { name, notes, is_active, sort_order } = req.body;
    const { rows } = await pool.query(
      `UPDATE global_suppliers
         SET name = COALESCE($1, name),
             notes = $2,
             is_active = COALESCE($3, is_active),
             sort_order = COALESCE($4, sort_order)
       WHERE id = $5 RETURNING *`,
      [name?.trim() || null, notes ?? null, is_active ?? null, sort_order ?? null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Supplier not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /bidder/global-suppliers/:id error:', err);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

// DELETE /api/bidder/global-suppliers/:id
router.delete('/global-suppliers/:id', requireRole('master'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM global_suppliers WHERE id = $1 RETURNING id', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Supplier not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /bidder/global-suppliers/:id error:', err);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
});

// ── Shared helper: push one global supplier product to all enabled companies ──
async function pushProductToEnabledCompanies(client, supplierId, product) {
  const companies = await client.query(
    `SELECT csa.company_id, bc.id AS cat_id
     FROM company_supplier_access csa
     JOIN bidder_categories bc ON bc.company_id = csa.company_id AND bc.source_supplier_id = csa.supplier_id
     WHERE csa.supplier_id = $1`,
    [supplierId]
  );
  for (const co of companies.rows) {
    const sortOrder = parseInt((await client.query(
      'SELECT COUNT(*) FROM bidder_library_items WHERE category_id = $1', [co.cat_id]
    )).rows[0].count, 10);

    if (product.is_system) {
      const comps = (await client.query(
        'SELECT component_product_id, sort_order FROM global_supplier_system_components WHERE system_product_id = $1 ORDER BY sort_order',
        [product.id]
      )).rows;

      const sysItem = (await client.query(
        `INSERT INTO bidder_library_items
           (category_id, company_id, name, description, default_unit_price, default_unit_label,
            color, sku, is_system, sort_order, source_supplier_product_id, internal_name, internal_description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10,$11,$12) RETURNING id`,
        [co.cat_id, co.company_id, product.name, product.description,
         product.default_unit_price, product.default_unit_label,
         product.color || null, product.sku || null, sortOrder, product.id,
         product.internal_name || null, product.internal_description || null]
      )).rows[0];

      for (let ci = 0; ci < comps.length; ci++) {
        const libComp = (await client.query(
          'SELECT id FROM bidder_library_items WHERE company_id = $1 AND source_supplier_product_id = $2 LIMIT 1',
          [co.company_id, comps[ci].component_product_id]
        )).rows[0];
        if (libComp) {
          await client.query(
            'INSERT INTO bidder_library_system_components (system_item_id, component_item_id, sort_order) VALUES ($1,$2,$3)',
            [sysItem.id, libComp.id, ci]
          );
        }
      }
    } else {
      await client.query(
        `INSERT INTO bidder_library_items
           (category_id, company_id, name, description, default_unit_price, default_unit_label,
            color, sku, kit_price, sqft_per_kit, is_charge_only, sort_order, source_supplier_product_id,
            internal_name, internal_description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [co.cat_id, co.company_id, product.name, product.description,
         product.default_unit_price, product.default_unit_label,
         product.color || null, product.sku || null,
         product.kit_price ?? null, product.sqft_per_kit ?? null,
         product.is_charge_only, sortOrder, product.id,
         product.internal_name || null, product.internal_description || null]
      );
    }
  }
}

// GET /api/bidder/global-suppliers/:supplierId/products  (includes system components)
router.get('/global-suppliers/:supplierId/products', requireRole('master'), async (req, res) => {
  try {
    const products = (await pool.query(
      'SELECT * FROM global_supplier_products WHERE supplier_id = $1 ORDER BY is_system, sort_order, name',
      [req.params.supplierId]
    )).rows;

    const systemIds = products.filter((p) => p.is_system).map((p) => p.id);
    let componentsBySystem = {};
    if (systemIds.length > 0) {
      const compRows = (await pool.query(
        `SELECT sc.system_product_id, sc.component_product_id, gsp.name
         FROM global_supplier_system_components sc
         JOIN global_supplier_products gsp ON gsp.id = sc.component_product_id
         WHERE sc.system_product_id = ANY($1)
         ORDER BY sc.sort_order`,
        [systemIds]
      )).rows;
      compRows.forEach((r) => {
        if (!componentsBySystem[r.system_product_id]) componentsBySystem[r.system_product_id] = [];
        componentsBySystem[r.system_product_id].push(r);
      });
    }

    res.json(products.map((p) =>
      p.is_system ? { ...p, components: componentsBySystem[p.id] || [] } : p
    ));
  } catch (err) {
    console.error('GET /bidder/global-suppliers/:supplierId/products error:', err);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

// POST /api/bidder/global-suppliers/:supplierId/products  (regular item or system)
router.post('/global-suppliers/:supplierId/products', requireRole('master'), async (req, res) => {
  try {
    const supplierId = parseInt(req.params.supplierId, 10);
    const {
      name, description = null,
      default_unit_price = 0, default_unit_label = 'per sqft',
      color = null, sku = null, kit_price = null, sqft_per_kit = null,
      is_charge_only = false, is_system = false, component_ids = [], sort_order = 0,
      internal_name = null, internal_description = null,
    } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

    let newProduct;
    await pool.transaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO global_supplier_products
           (supplier_id, name, description, default_unit_price, default_unit_label,
            color, sku, kit_price, sqft_per_kit, is_charge_only, is_system, sort_order, internal_name, internal_description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [supplierId, name.trim(), description,
         parseFloat(default_unit_price) || 0, default_unit_label,
         color || null, sku || null,
         !is_system && kit_price !== null && kit_price !== '' ? parseFloat(kit_price) : null,
         !is_system && sqft_per_kit !== null && sqft_per_kit !== '' ? parseFloat(sqft_per_kit) : null,
         is_charge_only, is_system, sort_order, internal_name || null, internal_description || null]
      );
      newProduct = ins.rows[0];

      if (is_system && component_ids.length > 0) {
        for (let i = 0; i < component_ids.length; i++) {
          await client.query(
            'INSERT INTO global_supplier_system_components (system_product_id, component_product_id, sort_order) VALUES ($1,$2,$3)',
            [newProduct.id, component_ids[i], i]
          );
        }
      }

      // Push to all companies that have this supplier enabled
      await pushProductToEnabledCompanies(client, supplierId, newProduct);
    });

    res.status(201).json(newProduct);
  } catch (err) {
    console.error('POST /bidder/global-suppliers/:supplierId/products error:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/bidder/global-supplier-products/:id  (updates global record + system components)
router.put('/global-supplier-products/:id', requireRole('master'), async (req, res) => {
  try {
    const {
      name, description, default_unit_price, default_unit_label,
      color, sku, kit_price, sqft_per_kit, is_charge_only, is_active, sort_order,
      component_ids, internal_name, internal_description,
    } = req.body;

    let updated;
    await pool.transaction(async (client) => {
      const res2 = await client.query(
        `UPDATE global_supplier_products SET
           name                 = COALESCE($1, name),
           description          = $2,
           default_unit_price   = COALESCE($3, default_unit_price),
           default_unit_label   = COALESCE($4, default_unit_label),
           color                = $5,
           sku                  = $6,
           kit_price            = $7,
           sqft_per_kit         = $8,
           is_charge_only       = COALESCE($9, is_charge_only),
           is_active            = COALESCE($10, is_active),
           sort_order           = COALESCE($11, sort_order),
           internal_name        = $12,
           internal_description = $13
         WHERE id = $14 RETURNING *`,
        [
          name?.trim() || null, description ?? null,
          default_unit_price !== undefined ? (parseFloat(default_unit_price) || 0) : null,
          default_unit_label || null, color ?? null, sku ?? null,
          kit_price !== undefined && kit_price !== '' ? parseFloat(kit_price) : null,
          sqft_per_kit !== undefined && sqft_per_kit !== '' ? parseFloat(sqft_per_kit) : null,
          is_charge_only ?? null, is_active ?? null, sort_order ?? null,
          internal_name ?? null, internal_description ?? null,
          req.params.id,
        ]
      );
      if (!res2.rows.length) throw Object.assign(new Error('not found'), { status: 404 });
      updated = res2.rows[0];

      if (updated.is_system && Array.isArray(component_ids)) {
        await client.query('DELETE FROM global_supplier_system_components WHERE system_product_id = $1', [updated.id]);
        for (let i = 0; i < component_ids.length; i++) {
          await client.query(
            'INSERT INTO global_supplier_system_components (system_product_id, component_product_id, sort_order) VALUES ($1,$2,$3)',
            [updated.id, component_ids[i], i]
          );
        }
      }

      // Cascade name + internal fields to company library copies
      await client.query(
        `UPDATE bidder_library_items
         SET name = $1, internal_name = $2, internal_description = $3
         WHERE source_supplier_product_id = $4`,
        [updated.name, updated.internal_name, updated.internal_description, updated.id]
      );
    });

    res.json(updated);
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: 'Product not found' });
    console.error('PUT /bidder/global-supplier-products/:id error:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/bidder/global-supplier-products/:id
router.delete('/global-supplier-products/:id', requireRole('master'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM global_supplier_products WHERE id = $1 RETURNING id', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /bidder/global-supplier-products/:id error:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
