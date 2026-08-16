// ============================================================================
// File: routes/visualizer.js
// Public: chip-colors, start, status, lead capture (company identified by query param)
// Protected master: chip color library CRUD
// Protected admin: company chip selection management
// ============================================================================

const express = require('express');
const multer = require('multer');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { generateVisualization } = require('../visualizer/renderingService');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { r2, BUCKET, PUBLIC_URL } = require('../config/r2');
const crypto = require('crypto');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ============================================================================
// PUBLIC ROUTES — no JWT, company identified by ?company= param
// ============================================================================

// GET /api/visualizer/chip-colors?company=123
// Returns ALL active library colors; company's 6 selections are marked featured:true (shown first)
router.get('/chip-colors', async (req, res) => {
  const { company } = req.query;
  if (!company) return res.status(400).json({ error: 'company param required' });

  try {
    const { rows } = await db.query(
      `SELECT cc.id, cc.name, cc.reference_image_url,
              (ccs.id IS NOT NULL) AS featured,
              COALESCE(ccs.sort_order, 9999) AS sort_order
       FROM chip_colors cc
       LEFT JOIN company_chip_selections ccs
         ON ccs.chip_color_id = cc.id AND ccs.company_id = $1
       WHERE cc.is_active = true
       ORDER BY featured DESC, ccs.sort_order, cc.name`,
      [company]
    );
    res.json({ colors: rows });
  } catch (err) {
    console.error('GET /visualizer/chip-colors error:', err);
    res.status(500).json({ error: 'Failed to load chip colors' });
  }
});

// POST /api/visualizer/start — upload image, kick off generation, return id immediately
router.post('/start', upload.single('image'), async (req, res) => {
  const { company_id, chip_color_id } = req.body;
  if (!company_id || !chip_color_id) return res.status(400).json({ error: 'company_id and chip_color_id required' });
  if (!req.file) return res.status(400).json({ error: 'image file required' });

  try {
    const co = await db.query(
      `SELECT id, visualizer_enabled FROM companies WHERE id=$1 AND deleted_at IS NULL`,
      [company_id]
    );
    if (!co.rows.length) return res.status(404).json({ error: 'Company not found' });
    if (!co.rows[0].visualizer_enabled) return res.status(403).json({ error: 'Visualizer not enabled for this company' });

    // Validate chip is in this company's selection
    const chip = await db.query(
      `SELECT cc.id, cc.name, cc.description, cc.reference_image_url
       FROM chip_colors cc
       JOIN company_chip_selections ccs ON ccs.chip_color_id = cc.id
       WHERE cc.id=$1 AND ccs.company_id=$2 AND cc.is_active=true`,
      [chip_color_id, company_id]
    );
    if (!chip.rows.length) return res.status(404).json({ error: 'Chip color not found' });

    const { rows } = await db.query(
      `INSERT INTO visualizations (company_id, chip_color_id, rendering_provider, status)
       VALUES ($1, $2, $3, 'processing') RETURNING id`,
      [company_id, chip_color_id, process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1']
    );
    const visualizationId = rows[0].id;

    res.json({ visualization_id: visualizationId });

    setImmediate(() => {
      generateVisualization({
        visualizationId,
        rawImageBuffer: req.file.buffer,
        chipColor: chip.rows[0],
        companyId: company_id,
      }).catch((err) => console.error('[Visualizer] background error:', err.message));
    });
  } catch (err) {
    console.error('POST /visualizer/start error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to start visualization' });
  }
});

// GET /api/visualizer/status/:id
router.get('/status/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, status, original_image_url, generated_image_url, error_message
       FROM visualizations WHERE id=$1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /visualizer/status error:', err);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// POST /api/visualizer/lead — capture contact info, create lead, link visualization
router.post('/lead', async (req, res) => {
  const { visualization_id, company_id, name, phone, email } = req.body;
  if (!company_id || !name || !phone) return res.status(400).json({ error: 'company_id, name, and phone required' });

  try {
    const leadRes = await db.query(
      `INSERT INTO leads (company_id, name, phone, email, lead_source, referral_source, status, created_at)
       VALUES ($1, $2, $3, $4, 'visualizer', 'visualizer', 'status_pre_lead', NOW())
       RETURNING id`,
      [company_id, name, phone, email || null]
    );
    const leadId = leadRes.rows[0].id;

    if (visualization_id) {
      await db.query(
        `UPDATE visualizations SET lead_id=$1 WHERE id=$2 AND company_id=$3`,
        [leadId, visualization_id, company_id]
      );
    }

    res.json({ ok: true, lead_id: leadId });
  } catch (err) {
    console.error('POST /visualizer/lead error:', err);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// ============================================================================
// MASTER-ONLY ROUTES — platform chip color library management
// ============================================================================

const chipRefUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/visualizer/library — full platform library
router.get('/library', authenticateToken, requireRole('master'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, description, product_code, source, reference_image_url, sort_order, is_active, created_at
       FROM chip_colors ORDER BY sort_order, name`
    );
    res.json({ colors: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load library' });
  }
});

// POST /api/visualizer/library — add color to platform library
router.post('/library', authenticateToken, requireRole('master'), chipRefUpload.single('reference_image'), async (req, res) => {
  const { name, description, product_code, sort_order, source } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  try {
    let refKey = null;
    let refUrl = null;

    if (req.file) {
      refKey = `visualizer/chip-library/${crypto.randomUUID()}.jpg`;
      await r2.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: refKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      }));
      refUrl = `${PUBLIC_URL}/${refKey}`;
    }

    const { rows } = await db.query(
      `INSERT INTO chip_colors (name, description, product_code, source, reference_image_key, reference_image_url, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, description || null, product_code || null, source || 'manual', refKey, refUrl, sort_order || 0]
    );
    res.json({ color: rows[0] });
  } catch (err) {
    console.error('POST /visualizer/library error:', err);
    res.status(500).json({ error: 'Failed to create chip color' });
  }
});

// PUT /api/visualizer/library/:id
router.put('/library/:id', authenticateToken, requireRole('master'), chipRefUpload.single('reference_image'), async (req, res) => {
  const { name, description, product_code, sort_order, is_active } = req.body;

  try {
    let refKey = null;
    let refUrl = null;

    if (req.file) {
      refKey = `visualizer/chip-library/${crypto.randomUUID()}.jpg`;
      await r2.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: refKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      }));
      refUrl = `${PUBLIC_URL}/${refKey}`;
    }

    const { rows } = await db.query(
      `UPDATE chip_colors
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           product_code = COALESCE($3, product_code),
           sort_order = COALESCE($4, sort_order),
           is_active = COALESCE($5, is_active),
           reference_image_key = COALESCE($6, reference_image_key),
           reference_image_url = COALESCE($7, reference_image_url)
       WHERE id=$8
       RETURNING *`,
      [name || null, description || null, product_code || null, sort_order ?? null, is_active ?? null, refKey, refUrl, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ color: rows[0] });
  } catch (err) {
    console.error('PUT /visualizer/library error:', err);
    res.status(500).json({ error: 'Failed to update chip color' });
  }
});

// DELETE /api/visualizer/library/:id — soft delete
router.delete('/library/:id', authenticateToken, requireRole('master'), async (req, res) => {
  try {
    await db.query(`UPDATE chip_colors SET is_active=false WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate chip color' });
  }
});

// ============================================================================
// ADMIN ROUTES — company manages their own color selections (up to 6)
// ============================================================================

// GET /api/visualizer/admin/selections — library with selected status for this company
router.get('/admin/selections', authenticateToken, async (req, res) => {
  const companyId = req.user.company_id;
  try {
    const { rows } = await db.query(
      `SELECT cc.id, cc.name, cc.description, cc.product_code, cc.reference_image_url, cc.sort_order,
              (ccs.id IS NOT NULL) AS selected, ccs.sort_order AS selection_order
       FROM chip_colors cc
       LEFT JOIN company_chip_selections ccs
         ON ccs.chip_color_id = cc.id AND ccs.company_id = $1
       WHERE cc.is_active = true
       ORDER BY selected DESC, ccs.sort_order, cc.name`,
      [companyId]
    );
    res.json({ colors: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load selections' });
  }
});

// POST /api/visualizer/admin/selections — add a color to company selection
router.post('/admin/selections', authenticateToken, async (req, res) => {
  const companyId = req.user.company_id;
  const { chip_color_id, sort_order } = req.body;
  if (!chip_color_id) return res.status(400).json({ error: 'chip_color_id required' });

  try {
    // Enforce max 6
    const { rows: existing } = await db.query(
      `SELECT COUNT(*) FROM company_chip_selections WHERE company_id=$1`, [companyId]
    );
    if (parseInt(existing[0].count) >= 6) {
      return res.status(400).json({ error: 'Maximum 6 colors per company. Remove one first.' });
    }

    await db.query(
      `INSERT INTO company_chip_selections (company_id, chip_color_id, sort_order)
       VALUES ($1, $2, $3) ON CONFLICT (company_id, chip_color_id) DO NOTHING`,
      [companyId, chip_color_id, sort_order || 0]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /visualizer/admin/selections error:', err);
    res.status(500).json({ error: 'Failed to add selection' });
  }
});

// DELETE /api/visualizer/admin/selections/:chip_color_id — remove a color from company selection
router.delete('/admin/selections/:chip_color_id', authenticateToken, async (req, res) => {
  const companyId = req.user.company_id;
  try {
    await db.query(
      `DELETE FROM company_chip_selections WHERE company_id=$1 AND chip_color_id=$2`,
      [companyId, req.params.chip_color_id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove selection' });
  }
});

module.exports = router;
