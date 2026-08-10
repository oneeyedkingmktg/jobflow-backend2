// ============================================================================
// File: routes/visualizer.js
// Public: chip-colors, start, status, lead capture (company identified by query param)
// Protected: admin CRUD for chip colors (JWT required)
// ============================================================================

const express = require('express');
const multer = require('multer');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { generateVisualization } = require('../visualizer/renderingService');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { r2, BUCKET, PUBLIC_URL } = require('../config/r2');
const crypto = require('crypto');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ============================================================================
// PUBLIC ROUTES — no JWT, company identified by ?company= param
// ============================================================================

// GET /api/visualizer/chip-colors?company=123
router.get('/chip-colors', async (req, res) => {
  const { company } = req.query;
  if (!company) return res.status(400).json({ error: 'company param required' });

  try {
    const { rows } = await db.query(
      `SELECT id, name, description, reference_image_url, sort_order
       FROM chip_colors
       WHERE company_id = $1 AND is_active = true
       ORDER BY sort_order, name`,
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
    // Validate company has visualizer enabled
    const co = await db.query(
      `SELECT id, visualizer_enabled FROM companies WHERE id=$1 AND deleted_at IS NULL`,
      [company_id]
    );
    if (!co.rows.length) return res.status(404).json({ error: 'Company not found' });
    if (!co.rows[0].visualizer_enabled) return res.status(403).json({ error: 'Visualizer not enabled for this company' });

    // Validate chip color belongs to this company
    const chip = await db.query(
      `SELECT id, name, description FROM chip_colors WHERE id=$1 AND company_id=$2 AND is_active=true`,
      [chip_color_id, company_id]
    );
    if (!chip.rows.length) return res.status(404).json({ error: 'Chip color not found' });

    // Create visualization record (processing)
    const { rows } = await db.query(
      `INSERT INTO visualizations (company_id, chip_color_id, rendering_provider, status)
       VALUES ($1, $2, $3, 'processing') RETURNING id`,
      [company_id, chip_color_id, process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1']
    );
    const visualizationId = rows[0].id;

    // Return id immediately, process in background
    res.json({ visualization_id: visualizationId });

    // Fire-and-forget — runs after response is sent
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
    // Create lead
    const leadRes = await db.query(
      `INSERT INTO leads (company_id, name, phone, email, lead_source, referral_source, status, created_at)
       VALUES ($1, $2, $3, $4, 'visualizer', 'visualizer', 'status_pre_lead', NOW())
       RETURNING id`,
      [company_id, name, phone, email || null]
    );
    const leadId = leadRes.rows[0].id;

    // Link visualization to lead
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
// PROTECTED ADMIN ROUTES — JWT required, chip color management
// ============================================================================

// GET /api/visualizer/admin/chip-colors
router.get('/admin/chip-colors', authenticateToken, async (req, res) => {
  const companyId = req.user.company_id;
  try {
    const { rows } = await db.query(
      `SELECT * FROM chip_colors WHERE company_id=$1 ORDER BY sort_order, name`,
      [companyId]
    );
    res.json({ colors: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load chip colors' });
  }
});

const chipRefUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// POST /api/visualizer/admin/chip-colors — create with optional reference image
router.post('/admin/chip-colors', authenticateToken, chipRefUpload.single('reference_image'), async (req, res) => {
  const companyId = req.user.company_id;
  const { name, description, sort_order } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  try {
    let refKey = null;
    let refUrl = null;

    if (req.file) {
      refKey = `visualizer/chip-refs/${companyId}/${crypto.randomUUID()}.png`;
      await r2.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: refKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      }));
      refUrl = `${PUBLIC_URL}/${refKey}`;
    }

    const { rows } = await db.query(
      `INSERT INTO chip_colors (company_id, name, description, reference_image_key, reference_image_url, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [companyId, name, description || null, refKey, refUrl, sort_order || 0]
    );
    res.json({ color: rows[0] });
  } catch (err) {
    console.error('POST /visualizer/admin/chip-colors error:', err);
    res.status(500).json({ error: 'Failed to create chip color' });
  }
});

// PUT /api/visualizer/admin/chip-colors/:id
router.put('/admin/chip-colors/:id', authenticateToken, chipRefUpload.single('reference_image'), async (req, res) => {
  const companyId = req.user.company_id;
  const { name, description, sort_order, is_active } = req.body;

  try {
    let refKey = null;
    let refUrl = null;

    if (req.file) {
      refKey = `visualizer/chip-refs/${companyId}/${crypto.randomUUID()}.png`;
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
           sort_order = COALESCE($3, sort_order),
           is_active = COALESCE($4, is_active),
           reference_image_key = COALESCE($5, reference_image_key),
           reference_image_url = COALESCE($6, reference_image_url)
       WHERE id=$7 AND company_id=$8
       RETURNING *`,
      [name || null, description || null, sort_order ?? null, is_active ?? null, refKey, refUrl, req.params.id, companyId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ color: rows[0] });
  } catch (err) {
    console.error('PUT /visualizer/admin/chip-colors error:', err);
    res.status(500).json({ error: 'Failed to update chip color' });
  }
});

// DELETE /api/visualizer/admin/chip-colors/:id — soft delete (deactivate)
router.delete('/admin/chip-colors/:id', authenticateToken, async (req, res) => {
  const companyId = req.user.company_id;
  try {
    await db.query(
      `UPDATE chip_colors SET is_active=false WHERE id=$1 AND company_id=$2`,
      [req.params.id, companyId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete chip color' });
  }
});

module.exports = router;
