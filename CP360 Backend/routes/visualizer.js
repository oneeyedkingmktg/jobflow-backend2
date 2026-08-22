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
const { generateVisualization, compositeCustomBlend, compositeInternalBlend } = require('../visualizer/renderingService');
const { getAllPrimitives, hexToRgb, getRecipe } = require('../visualizer/chipColorData');
const { resolveLeadFolder, uploadFileToFolder } = require('../controllers/googleDrive');
const { sendVisualizationEmail, sendSwatchEmail } = require('../services/email');
const sharp = require('sharp');
const axios = require('axios');
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

// GET /api/visualizer/primitives — all 126 Torginol chip colors (name, F-code, hex) for custom blend builder
router.get('/primitives', (req, res) => {
  try {
    res.json({ colors: getAllPrimitives() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load color library' });
  }
});

// POST /api/visualizer/composite-custom — synchronous custom blend composite (reuses cached SAM 2 mask)
// Body: { source_visualization_id, company_id, recipe: [{hex, percentage}] }
router.post('/composite-custom', async (req, res) => {
  const { source_visualization_id, company_id, recipe } = req.body;
  if (!source_visualization_id || !company_id || !Array.isArray(recipe) || !recipe.length) {
    return res.status(400).json({ error: 'source_visualization_id, company_id, and recipe are required' });
  }

  try {
    const converted = recipe.map(({ hex, percentage }) => ({
      rgb:    hexToRgb(hex),
      weight: (parseFloat(percentage) || 0) / 100,
    })).filter(c => c.weight > 0);

    if (!converted.length) return res.status(400).json({ error: 'Recipe has no valid entries' });

    const result = await compositeCustomBlend({
      sourceVisualizationId: source_visualization_id,
      companyId:             company_id,
      recipe:                converted,
    });

    res.json(result);
  } catch (err) {
    console.error('POST /visualizer/composite-custom error:', err);
    const statusCode = err.status || 500;
    res.status(statusCode).json({ error: err.message });
  }
});

// POST /api/visualizer/pregenerate — start all 6 featured colors in background immediately
router.post('/pregenerate', upload.single('image'), async (req, res) => {
  const { company_id } = req.body;
  if (!company_id) return res.status(400).json({ error: 'company_id required' });
  if (!req.file) return res.status(400).json({ error: 'image required' });

  try {
    const co = await db.query(
      `SELECT id, visualizer_enabled FROM companies WHERE id=$1 AND deleted_at IS NULL`,
      [company_id]
    );
    if (!co.rows.length) return res.status(404).json({ error: 'Company not found' });
    if (!co.rows[0].visualizer_enabled) return res.status(403).json({ error: 'Visualizer not enabled' });

    const { rows: featured } = await db.query(
      `SELECT cc.id, cc.name, cc.description, cc.reference_image_url
       FROM chip_colors cc
       JOIN company_chip_selections ccs ON ccs.chip_color_id = cc.id
       WHERE ccs.company_id = $1 AND cc.is_active = true
       ORDER BY ccs.sort_order, cc.name`,
      [company_id]
    );

    if (!featured.length) return res.json({ generations: [] });

    // Create all visualization records first
    const generations = [];
    for (const chip of featured) {
      const { rows } = await db.query(
        `INSERT INTO visualizations (company_id, chip_color_id, rendering_provider, status)
         VALUES ($1, $2, $3, 'processing') RETURNING id`,
        [company_id, chip.id, process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1']
      );
      generations.push({
        chip_color_id: chip.id,
        visualization_id: rows[0].id,
        name: chip.name,
        reference_image_url: chip.reference_image_url,
      });
    }

    // Respond immediately — run SAM 2 ONCE then fire all color composites in parallel
    res.json({ generations });

    const rawBuffer = req.file.buffer;

    // Run the segmentation pipeline once and share the mask across all colors
    generateVisualization({
      visualizationId: generations[0].visualization_id,
      rawImageBuffer:  rawBuffer,
      chipColor:       featured.find(c => c.id === generations[0].chip_color_id),
      companyId:       company_id,
      isLeader:        true,  // this call runs SAM 2 and stores the mask
      followers:       generations.slice(1).map(g => ({
        visualizationId: g.visualization_id,
        chipColor:       featured.find(c => c.id === g.chip_color_id),
      })),
    }).catch(err => console.error(`[Pregenerate] leader failed:`, err.message));
  } catch (err) {
    console.error('POST /visualizer/pregenerate error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to start pregeneration' });
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

    // Validate chip exists in platform library (any active color is usable)
    const chip = await db.query(
      `SELECT id, name, description, reference_image_url
       FROM chip_colors WHERE id=$1 AND is_active=true`,
      [chip_color_id]
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
      `SELECT id, status, original_image_url, generated_image_url, error_message, failure_type
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

// POST /api/visualizer/lead — capture contact info, create lead, link visualization, save to Drive
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

      // Save visualization image to Drive in background — never fails the response
      saveVisualizationToDrive(leadId, visualization_id, name).catch(err => {
        if (!err.noDrive) console.error('[Visualizer] Drive save failed:', err.message);
      });
    }

    res.json({ ok: true, lead_id: leadId });
  } catch (err) {
    console.error('POST /visualizer/lead error:', err);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// Background helper — saves generated visualization image to the lead's Drive folder
async function saveVisualizationToDrive(leadId, visualizationId, customerName) {
  const { rows } = await db.query(
    `SELECT v.generated_image_url, cc.name AS chip_name
     FROM visualizations v
     LEFT JOIN chip_colors cc ON cc.id = v.chip_color_id
     WHERE v.id = $1 AND v.status = 'complete'`,
    [visualizationId]
  );
  if (!rows.length || !rows[0].generated_image_url) return;

  const { generated_image_url, chip_name } = rows[0];
  const folder = await resolveLeadFolder(leadId, { create: true });

  const resp   = await axios.get(generated_image_url, { responseType: 'arraybuffer', timeout: 30000 });
  const buffer = Buffer.from(resp.data);
  const label  = chip_name ? chip_name : 'Custom Blend';
  const date   = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const fileName = `Floor Preview - ${label} (${date}).png`;

  await uploadFileToFolder(folder.id, fileName, 'image/png', buffer);
  console.log(`[Visualizer] Saved "${fileName}" to Drive for lead ${leadId}`);
}

// POST /api/visualizer/send-email — email before/after images to the customer
router.post('/send-email', async (req, res) => {
  const { visualization_id, company_id, customer_email, customer_name } = req.body;
  if (!visualization_id || !company_id || !customer_email) {
    return res.status(400).json({ error: 'visualization_id, company_id, and customer_email required' });
  }

  try {
    const vizRes = await db.query(
      `SELECT v.original_image_url, v.generated_image_url,
              c.name AS company_name, c.phone AS company_phone,
              c.primary_color, c.accent_color, c.logo_url
       FROM visualizations v
       JOIN companies c ON c.id = v.company_id
       WHERE v.id = $1 AND v.company_id = $2 AND v.status = 'complete'`,
      [visualization_id, company_id]
    );
    if (!vizRes.rows.length) return res.status(404).json({ error: 'Visualization not found' });

    const row = vizRes.rows[0];
    await sendVisualizationEmail({
      toEmail:           customer_email,
      customerName:      customer_name || null,
      companyName:       row.company_name,
      originalImageUrl:  row.original_image_url,
      generatedImageUrl: row.generated_image_url,
      primaryColor:      row.primary_color  || null,
      accentColor:       row.accent_color   || null,
      logoUrl:           row.logo_url       || null,
      companyPhone:      row.company_phone  || null,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /visualizer/send-email error:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// ============================================================================
// INTERNAL CRM ROUTES — authenticated, for use inside contact records
// ============================================================================

// GET /api/visualizer/recipe/:chip_color_id — recipe for a library chip color
router.get('/recipe/:chip_color_id', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name FROM chip_colors WHERE id=$1 AND is_active=true`,
      [req.params.chip_color_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Chip color not found' });

    const rawRecipe = getRecipe(rows[0].name);
    if (!rawRecipe || !rawRecipe.length) {
      return res.status(404).json({ error: 'No blend recipe found for this color' });
    }

    const recipe = rawRecipe.map(item => ({
      hex:        item.hex  || null,
      name:       item.name || null,
      percentage: Math.round((item.weight || 0) * 100),
    }));

    res.json({ chip_color: rows[0], recipe });
  } catch (err) {
    console.error('GET /visualizer/recipe error:', err);
    res.status(500).json({ error: 'Failed to load recipe' });
  }
});

// POST /api/visualizer/swatch — generate a blend swatch PNG, optionally save to Drive
// Body: { recipe: [{hex, name, percentage}], lead_id?, blend_name? }
// POST /api/visualizer/swatch
// Accepts multipart: image (PNG canvas from frontend), blend_name, recipe JSON, lead_id?
// Composites: title bar + chip image + legend → saves to R2, optionally Drive.
router.post('/swatch', authenticateToken, upload.single('image'), async (req, res) => {
  const { blend_name, recipe: recipeJson, lead_id } = req.body;
  if (!req.file)    return res.status(400).json({ error: 'image required' });
  if (!recipeJson)  return res.status(400).json({ error: 'recipe required' });

  try {
    const recipe    = JSON.parse(recipeJson);
    const companyId = req.user.company_id;
    const total     = recipe.reduce((s, r) => s + (parseFloat(r.percentage) || 0), 0) || 1;
    const sorted    = [...recipe].sort((a, b) => (parseFloat(b.percentage) || 0) - (parseFloat(a.percentage) || 0));

    const W       = 960;
    const TITLE_H = 80;
    const CHIP_H  = W;          // square chip preview
    const LEG_H   = 90;
    const xmlEsc  = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // ── 1. Resize chip canvas to 960×960 ─────────────────────────────────
    const chipBuf = await sharp(req.file.buffer).resize(W, CHIP_H).png().toBuffer();

    // ── 2. Title bar ──────────────────────────────────────────────────────
    const titleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${TITLE_H}">` +
      `<rect width="${W}" height="${TITLE_H}" fill="#ffffff"/>` +
      `<text x="${W / 2}" y="${TITLE_H / 2 + 13}" text-anchor="middle" ` +
        `font-family="Georgia,'Times New Roman',serif" font-size="38" ` +
        `font-weight="bold" fill="#1a1a2e">${xmlEsc(blend_name || 'Custom Blend')}</text>` +
      `</svg>`;
    const titleBuf = await sharp(Buffer.from(titleSvg)).resize(W, TITLE_H).png().toBuffer();

    // ── 3. Legend bar — "■ F-code Name XX%" per color ────────────────────
    const colW  = Math.floor(W / Math.max(sorted.length, 1));
    const SQ    = 20;
    const baseY = Math.round(LEG_H / 2);
    let legendItems = '';
    sorted.forEach((c, i) => {
      const pct      = Math.round((parseFloat(c.percentage) / total) * 100);
      const codePart = c.code || (c.name || '').match(/F-\d+/)?.[0] || '';
      const namePart = (c.name || '').split(' ')
        .filter(w => !/F-\d+/.test(w) && w.toLowerCase() !== 'torginol').join(' ');
      const label    = [codePart, namePart, `${pct}%`].filter(Boolean).join(' ');
      const ox       = i * colW + 16;
      legendItems +=
        `<rect x="${ox}" y="${baseY - SQ / 2}" width="${SQ}" height="${SQ}" fill="${c.hex}" rx="3"/>` +
        `<text x="${ox + SQ + 8}" y="${baseY + 7}" font-family="Arial,sans-serif" ` +
          `font-size="22" fill="#374151">${xmlEsc(label)}</text>`;
    });
    const legendSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${LEG_H}">` +
      `<rect width="${W}" height="${LEG_H}" fill="#f5f6f7"/>` +
      `<line x1="0" y1="0" x2="${W}" y2="0" stroke="#e5e7eb" stroke-width="1"/>` +
      legendItems +
      `</svg>`;
    const legendBuf = await sharp(Buffer.from(legendSvg)).resize(W, LEG_H).png().toBuffer();

    // ── 4. Composite title + chip + legend ────────────────────────────────
    const totalH = TITLE_H + CHIP_H + LEG_H;
    const finalBuf = await sharp({
      create: { width: W, height: totalH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    }).composite([
      { input: titleBuf,  left: 0, top: 0 },
      { input: chipBuf,   left: 0, top: TITLE_H },
      { input: legendBuf, left: 0, top: TITLE_H + CHIP_H },
    ]).png().toBuffer();

    // ── 5. Upload to R2 ───────────────────────────────────────────────────
    const swatchKey = `visualizer/swatches/${companyId}/${crypto.randomUUID()}.png`;
    await r2.send(new PutObjectCommand({ Bucket: BUCKET, Key: swatchKey, Body: finalBuf, ContentType: 'image/png' }));
    const swatchUrl = `${PUBLIC_URL}/${swatchKey}`;

    // ── 6. Async Drive save ───────────────────────────────────────────────
    if (lead_id) {
      const date     = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const label    = blend_name || sorted.map(c => c.name || c.hex).join(' / ').slice(0, 40);
      const fileName = `Blend Swatch - ${label} (${date}).png`;
      resolveLeadFolder(parseInt(lead_id), { create: true })
        .then(folder => uploadFileToFolder(folder.id, fileName, 'image/png', finalBuf))
        .catch(err  => { if (!err.noDrive) console.error('[Swatch] Drive save failed:', err.message); });
    }

    res.json({ swatch_url: swatchUrl });
  } catch (err) {
    console.error('POST /visualizer/swatch error:', err);
    res.status(500).json({ error: 'Failed to generate swatch' });
  }
});

// POST /api/visualizer/send-swatch-email — email swatch PNG to customer from a lead record
// Body: { swatch_url, lead_id, blend_description? }
router.post('/send-swatch-email', authenticateToken, async (req, res) => {
  const { swatch_url, lead_id, blend_description } = req.body;
  if (!swatch_url || !lead_id) {
    return res.status(400).json({ error: 'swatch_url and lead_id required' });
  }

  try {
    const { rows } = await db.query(
      `SELECT l.name AS customer_name, l.email AS customer_email,
              c.company_name, c.phone AS company_phone,
              c.primary_color, c.accent_color, c.logo_url
       FROM leads l
       JOIN companies c ON c.id = l.company_id
       WHERE l.id = $1 AND l.company_id = $2 AND l.deleted_at IS NULL`,
      [lead_id, req.user.company_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Lead not found' });

    const row = rows[0];
    if (!row.customer_email) return res.status(400).json({ error: 'Lead has no email address on file' });

    await sendSwatchEmail({
      toEmail:          row.customer_email,
      customerName:     row.customer_name,
      companyName:      row.company_name,
      swatchUrl:        swatch_url,
      blendDescription: blend_description || null,
      primaryColor:     row.primary_color  || null,
      accentColor:      row.accent_color   || null,
      logoUrl:          row.logo_url       || null,
      companyPhone:     row.company_phone  || null,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /visualizer/send-swatch-email error:', err);
    res.status(500).json({ error: 'Failed to send swatch email' });
  }
});

// POST /api/visualizer/apply-internal — upload photo + recipe, run composite pipeline in background
// Multipart: image file + recipe (JSON string) + lead_id + company_id
router.post('/apply-internal', authenticateToken, upload.single('image'), async (req, res) => {
  const { lead_id, recipe: recipeJson } = req.body;
  if (!lead_id || !recipeJson || !req.file) {
    return res.status(400).json({ error: 'lead_id, recipe, and image required' });
  }

  let recipe;
  try { recipe = JSON.parse(recipeJson); } catch { return res.status(400).json({ error: 'Invalid recipe JSON' }); }
  if (!Array.isArray(recipe) || !recipe.length) return res.status(400).json({ error: 'recipe must be a non-empty array' });

  try {
    const companyId = req.user.company_id;

    // Verify lead belongs to this company
    const leadCheck = await db.query(
      `SELECT id FROM leads WHERE id=$1 AND company_id=$2 AND deleted_at IS NULL`,
      [lead_id, companyId]
    );
    if (!leadCheck.rows.length) return res.status(404).json({ error: 'Lead not found' });

    // Convert recipe: [{hex, percentage}] → [{rgb, weight}]
    const converted = recipe.map(({ hex, percentage }) => ({
      rgb:    hexToRgb(hex),
      weight: (parseFloat(percentage) || 0) / 100,
    })).filter(c => c.weight > 0);
    if (!converted.length) return res.status(400).json({ error: 'Recipe has no valid entries' });

    const result = await compositeInternalBlend({
      leadId:        parseInt(lead_id),
      companyId,
      recipe:        converted,
      rawImageBuffer: req.file.buffer,
    });

    res.json(result);
  } catch (err) {
    console.error('POST /visualizer/apply-internal error:', err);
    res.status(500).json({ error: 'Failed to start visualization' });
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
