// ============================================================================
// File: routes/bidder.js
// Bidder feature — proposals, items, library, company settings, designs
// ============================================================================

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { sendProposalAcceptedEmails, sendProposalLinkEmail } = require('../services/email');
const Stripe = require('stripe');

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

// GET /api/bidder/proposals/:leadId — all proposals for a lead (selection screen)
router.get('/proposals/:leadId', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { leadId } = req.params;

    const result = await pool.query(
      `SELECT id, bid_name, bid_description, status, presented_date, accepted_date,
              bid_total, created_at, updated_at
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
      lead_id, bid_name, bid_description, status = 'pending',
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
        lead_id, company_id, bid_name, bid_description, status,
        presented_date, accepted_date, salesman, install_crew, install_date,
        install_date_tbd, output_mode, customer_notes, internal_notes,
        bid_total, down_payment_type, down_payment_value, down_payment_amount,
        balance_due, payment_url, include_payment_button, proposal_design_id,
        created_by_user_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
      ) RETURNING *`,
      [
        lead_id, companyId, bid_name, clean(bid_description), status,
        clean(presented_date), clean(accepted_date), salesman, clean(install_crew),
        clean(install_date), install_date_tbd, output_mode,
        clean(customer_notes), clean(internal_notes),
        bid_total, down_payment_type, down_payment_value, down_payment_amount,
        balance_due, clean(payment_url), include_payment_button, clean(proposal_design_id),
        req.user.id || null,
      ]
    );

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
        proposal_design_id = $19, salesman = $20, updated_at = NOW()
       WHERE id = $21 AND ($22::integer IS NULL OR company_id = $22::integer)
       RETURNING *`,
      [
        bid_name, clean(bid_description), status,
        clean(presented_date), resolvedAcceptedDate, clean(install_crew),
        clean(install_date), install_date_tbd, output_mode,
        clean(customer_notes), clean(internal_notes), bid_total,
        down_payment_type, down_payment_value,
        down_payment_amount, balance_due,
        clean(payment_url), include_payment_button,
        clean(proposal_design_id), salesman ?? null, id, companyId,
      ]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Proposal not found' });
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
      breakout_price = false, sort_order = 0,
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
        is_optional, is_freeform, breakout_price, sort_order
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        proposal_id, clean(library_item_id), clean(category_name), name, clean(description),
        unit_price, clean(unit_label), clean(quantity), line_total, is_included,
        is_optional, is_freeform, breakout_price, sort_order,
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
      breakout_price, sort_order,
    } = req.body;

    const result = await pool.query(
      `UPDATE bidder_proposal_items pi
       SET category_name = $1, name = $2, description = $3, unit_price = $4,
           unit_label = $5, quantity = $6, line_total = $7, is_included = $8,
           is_optional = $9, is_accepted = $10, breakout_price = $11, sort_order = $12
       FROM bidder_proposals p
       WHERE pi.id = $13 AND pi.proposal_id = p.id AND ($14::integer IS NULL OR p.company_id = $14::integer)
       RETURNING pi.*`,
      [
        clean(category_name), name, clean(description), unit_price,
        clean(unit_label), clean(quantity), line_total, is_included,
        is_optional, clean(is_accepted), breakout_price ?? false, sort_order,
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
    const { proposal_id, description, quantity = 1, price_each = 0, line_total = 0, sort_order = 0, is_subtotal = false } = req.body;

    const check = await pool.query(
      'SELECT id FROM bidder_proposals WHERE id = $1 AND ($2::integer IS NULL OR company_id = $2::integer)',
      [proposal_id, companyId]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Proposal not found' });

    const result = await pool.query(
      `INSERT INTO bidder_custom_items (proposal_id, description, quantity, price_each, line_total, sort_order, is_subtotal)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [proposal_id, description, quantity, price_each, line_total, sort_order, is_subtotal]
    );

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
    const { description, quantity, price_each, line_total, sort_order } = req.body;

    const result = await pool.query(
      `UPDATE bidder_custom_items ci
       SET description = $1, quantity = $2, price_each = $3, line_total = $4, sort_order = $5
       FROM bidder_proposals p
       WHERE ci.id = $6 AND ci.proposal_id = p.id AND ($7::integer IS NULL OR p.company_id = $7::integer)
       RETURNING ci.*`,
      [description, quantity, price_each, line_total, sort_order, req.params.id, companyId]
    );

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
    const companyId = req.user.company_id;

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
      'SELECT * FROM bidder_library_items WHERE company_id = $1 ORDER BY sort_order, id',
      [companyId]
    );

    // Group items under their categories
    const result = categories.rows.map((cat) => ({
      ...cat,
      items: items.rows.filter((i) => i.category_id === cat.id),
    }));

    res.json(result);
  } catch (err) {
    console.error('GET /bidder/library error:', err);
    res.status(500).json({ error: 'Failed to fetch library' });
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
    } = req.body;

    // Verify category belongs to this company
    const check = await pool.query(
      'SELECT id FROM bidder_categories WHERE id = $1 AND company_id = $2',
      [category_id, companyId]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Category not found' });

    const result = await pool.query(
      `INSERT INTO bidder_library_items (category_id, company_id, name, description, default_unit_price, default_unit_label, is_included, show_quantity, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [category_id, companyId, name, clean(description), default_unit_price, clean(default_unit_label), is_included, show_quantity, sort_order]
    );

    res.status(201).json(result.rows[0]);
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
    } = req.body;

    const result = await pool.query(
      `UPDATE bidder_library_items SET
        category_id = $1, name = $2, description = $3, default_unit_price = $4,
        default_unit_label = $5, is_included = $6, show_quantity = $7,
        is_active = $8, sort_order = $9
       WHERE id = $10 AND company_id = $11 RETURNING *`,
      [
        category_id, name, clean(description), default_unit_price,
        clean(default_unit_label), is_included, show_quantity,
        is_active, sort_order, req.params.id, companyId,
      ]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Library item not found' });
    res.json(result.rows[0]);
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
    // Never expose the secret key — send a boolean so the UI knows if one is saved
    const { stripe_secret_key, ...safeRow } = row;
    safeRow.stripe_secret_key_saved = !!stripe_secret_key;
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
      include_payment_button, down_payment_default_percent,
      preferred_proposal_design_id, terms_and_conditions, system_notes,
      email_from_name, email_from_email, proposal_top_text, invoice_top_text,
      proposal_domain, logo_url,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO bidder_company_settings
         (company_id, stripe_publishable_key, stripe_secret_key, include_payment_button,
          down_payment_default_percent, preferred_proposal_design_id, terms_and_conditions,
          system_notes, email_from_name, email_from_email, proposal_top_text, invoice_top_text,
          proposal_domain, logo_url, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
       ON CONFLICT (company_id) DO UPDATE SET
         stripe_publishable_key = EXCLUDED.stripe_publishable_key,
         stripe_secret_key = COALESCE(EXCLUDED.stripe_secret_key, bidder_company_settings.stripe_secret_key),
         include_payment_button = EXCLUDED.include_payment_button,
         down_payment_default_percent = EXCLUDED.down_payment_default_percent,
         preferred_proposal_design_id = EXCLUDED.preferred_proposal_design_id,
         terms_and_conditions = EXCLUDED.terms_and_conditions,
         system_notes = EXCLUDED.system_notes,
         email_from_name = EXCLUDED.email_from_name,
         email_from_email = EXCLUDED.email_from_email,
         proposal_top_text = EXCLUDED.proposal_top_text,
         invoice_top_text = EXCLUDED.invoice_top_text,
         proposal_domain = EXCLUDED.proposal_domain,
         logo_url = EXCLUDED.logo_url,
         updated_at = NOW()
       RETURNING *`,
      [
        companyId, clean(stripe_publishable_key),
        stripe_secret_key ? stripe_secret_key.trim() : null,
        include_payment_button,
        down_payment_default_percent, clean(preferred_proposal_design_id),
        clean(terms_and_conditions), clean(system_notes),
        clean(email_from_name), clean(email_from_email),
        clean(proposal_top_text), clean(invoice_top_text),
        clean(proposal_domain), clean(logo_url),
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /bidder/company-settings error:', err);
    res.status(500).json({ error: 'Failed to update company settings' });
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
              bcs.preferred_proposal_design_id, bcs.logo_url,
              u.name AS created_by_name,
              COALESCE(bpd_prop.primary_color, bpd_pref.primary_color) AS design_primary_color,
              COALESCE(bpd_prop.accent_color,  bpd_pref.accent_color)  AS design_accent_color
       FROM bidder_proposals bp
       JOIN companies c ON bp.company_id = c.id
       LEFT JOIN bidder_company_settings bcs ON bcs.company_id = c.id
       LEFT JOIN users u ON bp.created_by_user_id = u.id
       LEFT JOIN bidder_proposal_designs bpd_prop ON bpd_prop.id = bp.proposal_design_id
       LEFT JOIN bidder_proposal_designs bpd_pref ON bpd_pref.id = bcs.preferred_proposal_design_id
       WHERE bp.id = $1`,
      [req.params.id]
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
router.post('/proposal/:id/send-email', authenticateToken, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const result = await pool.query(
      `SELECT bp.bid_name, bp.bid_total, bp.company_id,
              bp.proposal_design_id,
              l.email as lead_email, l.full_name as lead_name, l.name as lead_name_short,
              c.ghl_company_from_name, c.name as company_db_name,
              bcs.email_from_name, bcs.email_from_email, bcs.proposal_domain,
              bcs.preferred_proposal_design_id,
              COALESCE(bpd_prop.primary_color, bpd_pref.primary_color) AS design_primary_color,
              COALESCE(bpd_prop.accent_color,  bpd_pref.accent_color)  AS design_accent_color
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
    const baseUrl      = row.proposal_domain
      ? `https://${row.proposal_domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
      : process.env.APP_URL;
    const proposalUrl  = `${baseUrl}/proposal/${req.params.id}`;
    const fromName     = row.email_from_name || companyName || undefined;
    const fromEmail    = row.email_from_email || undefined;
    const emailType    = req.body.type || 'proposal';
    const primaryColor = (row.proposal_design_id || row.preferred_proposal_design_id)
      ? (row.design_primary_color || '#1c2333')
      : null;
    const accentColor = (row.proposal_design_id || row.preferred_proposal_design_id)
      ? (row.design_accent_color || '#f97316')
      : null;

    await sendProposalLinkEmail({
      toEmail,
      customerName,
      companyName,
      bidName:   row.bid_name,
      bidTotal:  row.bid_total,
      proposalUrl,
      fromName,
      fromEmail,
      emailType,
      primaryColor,
      accentColor,
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
      'SELECT bp.*, l.email as lead_email, l.full_name as lead_name, l.name as lead_name_short, c.ghl_company_from_name, c.company_name as company_db_name, bcs.email_from_name, bcs.email_from_email FROM bidder_proposals bp JOIN leads l ON bp.lead_id = l.id JOIN companies c ON bp.company_id = c.id LEFT JOIN bidder_company_settings bcs ON bcs.company_id = c.id WHERE bp.id = $1',
      [req.params.id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Proposal not found' });

    const proposal = existing.rows[0];
    if (proposal.signed_at) {
      return res.status(409).json({ error: 'This proposal has already been signed' });
    }

    // Save signature
    await pool.query(
      'UPDATE bidder_proposals SET signature_name = $1, signed_at = $2, signature_ip = $3 WHERE id = $4',
      [signature_name.trim(), signedAt, ip, req.params.id]
    );

    // Fetch contractor email (company admin/owner)
    const contractorResult = await pool.query(
      `SELECT email FROM users WHERE company_id = $1 AND role IN ('admin', 'master') ORDER BY id ASC LIMIT 1`,
      [proposal.company_id]
    );
    const contractorEmail = contractorResult.rows[0]?.email || null;
    const companyName = proposal.ghl_company_from_name || proposal.company_db_name || '';
    const customerEmail = proposal.lead_email || null;
    const customerName = proposal.lead_name || proposal.lead_name_short || '';
    const proposalUrl = `${process.env.APP_URL}/proposal/${req.params.id}`;

    // Send emails (non-blocking — don't fail the request if email fails)
    sendProposalAcceptedEmails({
      proposalId: req.params.id,
      bidName: proposal.bid_name,
      signatureName: signature_name.trim(),
      signedAt,
      customerEmail,
      customerName,
      contractorEmail,
      companyName,
      proposalUrl,
      fromName: proposal.email_from_name || null,
      fromEmail: proposal.email_from_email || null,
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
    const { amount_cents, success_url, cancel_url } = req.body;
    if (!amount_cents || amount_cents <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Look up the company's Stripe secret key via the proposal
    const result = await pool.query(
      `SELECT bcs.stripe_secret_key, bp.bid_name
       FROM bidder_proposals bp
       JOIN bidder_company_settings bcs ON bcs.company_id = bp.company_id
       WHERE bp.id = $1`,
      [req.params.id]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Proposal not found' });
    const { stripe_secret_key, bid_name } = result.rows[0];
    if (!stripe_secret_key) return res.status(400).json({ error: 'Stripe is not configured for this account' });

    const stripe = Stripe(stripe_secret_key);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: bid_name || 'Proposal Payment' },
          unit_amount: Math.round(amount_cents),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: success_url || `${process.env.APP_URL}/proposal/${req.params.id}?payment=success`,
      cancel_url:  cancel_url  || `${process.env.APP_URL}/proposal/${req.params.id}`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('POST /bidder/public/:id/stripe-checkout error:', err);
    res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
});

module.exports = router;
