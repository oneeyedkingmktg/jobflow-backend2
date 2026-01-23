// ============================================================================
// File: routes/companies.js
// Version: v2.9.5 – Harden UPDATE: strip undefined keys + safe name handling
// ============================================================================
const express = require('express');
const bcrypt = require('bcryptjs');
const CryptoJS = require('crypto-js');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);
// 🔧 SURGICAL CHANGE: removed global master-only gate
// router.use(requireRole('master'));

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'change-this-encryption-key';

// Encrypt API key
const encryptApiKey = (apiKey) => {
  return CryptoJS.AES.encrypt(apiKey, ENCRYPTION_KEY).toString();
};

// Decrypt API key (used only by ghlAPI.js)
const decryptApiKey = (encryptedKey) => {
  if (!encryptedKey) return null;
  const bytes = CryptoJS.AES.decrypt(encryptedKey, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// ============================================================================
// GET ALL COMPANIES
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        c.*,
        COUNT(DISTINCT u.id) AS user_count,
        COUNT(DISTINCT l.id) AS lead_count
       FROM companies c
       LEFT JOIN users u ON c.id = u.company_id AND u.deleted_at IS NULL
       LEFT JOIN leads l ON c.id = l.company_id AND l.deleted_at IS NULL
       WHERE c.deleted_at IS NULL
       GROUP BY c.id
       ORDER BY c.created_at DESC`
    );

    const companies = result.rows.map((company) => {
      console.log("🔍 [BACKEND] Company ID", company.id, "fields:", {
        ghl_appt_calendar: company.ghl_appt_calendar,
        ghl_install_calendar: company.ghl_install_calendar,
        ghl_appt_assigned_user: company.ghl_appt_assigned_user,
      });
      
      // Hide API key
      if (company.ghl_api_key) {
        company.ghl_api_key = "***hidden***";
      }
      
      return company;
    });

    res.json({ companies });
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// ============================================================================
// GET SINGLE COMPANY
// ============================================================================
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT *
       FROM companies
       WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const company = result.rows[0];
    
    console.log("🔍 [BACKEND] RAW company from DB:", {
      ghl_appt_calendar: company.ghl_appt_calendar,
      ghl_install_calendar: company.ghl_install_calendar,
      ghl_appt_assigned_user: company.ghl_appt_assigned_user,
      ghl_install_assigned_user: company.ghl_install_assigned_user,
    });
    
    company.ghl_api_key = company.ghl_api_key ? '***hidden***' : null;

    console.log("🔍 [BACKEND] Sending to frontend:", company);

    res.json({ company });
  } catch (error) {
    console.error('Get company error:', error);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// ============================================================================
// CREATE COMPANY + ADMIN USER
// ============================================================================
router.post('/', requireRole('master'), async (req, res) => {
  try {
const {
  company_name,
  name,
  phone,
  email,
  website,
  address,
  city,
  state,
  zip,
  suspended,
  ghl_api_key,
  ghl_location_id,
  ghl_install_calendar,
  ghl_appt_calendar,
  ghl_appt_assigned_user,          // NEW
  ghl_install_assigned_user,        // NEW
  ghl_appt_title_template,          // NEW (optional, uses DB default)
  ghl_install_title_template,       // NEW (optional, uses DB default)
  ghl_appt_description_template,    // NEW (optional, uses DB default)
  ghl_install_description_template, // NEW (optional, uses DB default)
  estimator_enabled,
  billing_status,
  admin_email,
  admin_password,
  admin_name,
  admin_phone
} = req.body;

    const finalCompanyName = company_name || name;

    if (!finalCompanyName) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const encryptedApiKey =
      ghl_api_key && ghl_api_key !== '***hidden***'
        ? encryptApiKey(ghl_api_key)
        : null;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

const companyResult = await client.query(
        `INSERT INTO companies (
          company_name,
          phone,
          email,
          website,
          address,
          city,
          state,
          zip,
          suspended,
          ghl_api_key,
          ghl_location_id,
          ghl_install_calendar,
          ghl_appt_calendar,
          ghl_appt_assigned_user,
          ghl_install_assigned_user,
          ghl_appt_title_template,
          ghl_install_title_template,
          ghl_appt_description_template,
          ghl_install_description_template,
          estimator_enabled,
          billing_status
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
        RETURNING *`,
        [
          finalCompanyName,
          phone || null,
          email || null,
          website || null,
          address || null,
          city || null,
          state || null,
          zip || null,
          suspended || false,
          encryptedApiKey,
          ghl_location_id || null,
          ghl_install_calendar || null,
          ghl_appt_calendar || null,
          ghl_appt_assigned_user || null,
          ghl_install_assigned_user || null,
          ghl_appt_title_template || null,
          ghl_install_title_template || null,
          ghl_appt_description_template || null,
          ghl_install_description_template || null,
          estimator_enabled || false,
          billing_status || 'active'
        ]
      );

      const company = companyResult.rows[0];

      if (admin_email && admin_password && admin_name) {
        const existingUser = await client.query(
          `SELECT id FROM users WHERE email = $1`,
          [admin_email.toLowerCase()]
        );

        if (existingUser.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Admin email already registered' });
        }

        const passwordHash = await bcrypt.hash(admin_password, 10);

        await client.query(
          `INSERT INTO users (
            company_id,
            email,
            password_hash,
            name,
            phone,
            role,
            is_active
          )
          VALUES ($1,$2,$3,$4,$5,'admin',true)`,
          [
            company.id,
            admin_email.toLowerCase(),
            passwordHash,
            admin_name,
            admin_phone || null
          ]
        );
      }

      await client.query('COMMIT');

      company.ghl_api_key = company.ghl_api_key ? '***hidden***' : null;
      res.status(201).json({ company });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create company error:', error);
    res.status(500).json({ error: 'Failed to create company' });
  }
});

// ============================================================================
// UPDATE COMPANY + (OPTIONAL) ESTIMATOR CONFIGS
// ============================================================================
router.put('/:id', requireRole('master', 'admin'), async (req, res) => {


  const client = await db.pool.connect();

  try {
    // ----------------------------------------------------------------------
    // SAFETY: strip undefined keys so partial updates cannot wipe fields
    // ----------------------------------------------------------------------
    const sanitizedBody = {};
    Object.keys(req.body || {}).forEach((k) => {
      if (req.body[k] !== undefined) sanitizedBody[k] = req.body[k];
    });

    console.log('═══════════════════════════════════════');
    console.log('🔍 COMPANY UPDATE ROUTE HIT');
    console.log('Company ID:', req.params.id);
    console.log('GHL fields from req.body (sanitized):');
    console.log('  ghl_api_key:', sanitizedBody.ghl_api_key);
    console.log('  ghlApiKey:', sanitizedBody.ghlApiKey);
    console.log('  ghl_location_id:', sanitizedBody.ghl_location_id);
    console.log('  ghl_install_calendar:', sanitizedBody.ghl_install_calendar);
    console.log('  ghl_appt_calendar:', sanitizedBody.ghl_appt_calendar);
    console.log('  ghl_appt_assigned_user:', sanitizedBody.ghl_appt_assigned_user);
    console.log('  ghl_install_assigned_user:', sanitizedBody.ghl_install_assigned_user);
    console.log('  ghl_appt_title_template:', sanitizedBody.ghl_appt_title_template);
    console.log('  ghl_install_title_template:', sanitizedBody.ghl_install_title_template);
    console.log('  ghl_appt_description_template:', sanitizedBody.ghl_appt_description_template?.substring(0, 50) + '...');
    console.log('  ghl_install_description_template:', sanitizedBody.ghl_install_description_template?.substring(0, 50) + '...');

    const {
      company_name,
      name,
      phone,
      email,
      website,
      address,
      city,
      state,
      zip,
      suspended,
      google_drive_base_folder_id,

      ghl_api_key,
      ghlApiKey,
      ghl_location_id,
      ghlLocationId,
      ghl_install_calendar,
      ghlInstallCalendar,
      ghl_appt_calendar,
      ghlApptCalendar,
      ghl_appt_assigned_user,
      ghl_install_assigned_user,
      ghl_appt_title_template,
      ghl_install_title_template,
      ghl_appt_description_template,
      ghl_install_description_template,

      estimator_enabled,
      estimatorEnabled,

      // estimator_configs fields (must NOT be written to companies)
      text_color,
      font_family,
      base_font_size,
      primary_button_color,
      primary_button_text_color,
      primary_button_radius,
      primary_button_hover_color,
      accent_color,
      muted_text_color,
      card_background_color,
      card_border_radius,
      card_shadow_strength,
      max_width,
      use_embedded_styles,
      disclaimer_text,
      min_job_info_text,
      standard_info_text,
      ty_url_redirect,

      billing_status
    } = sanitizedBody;

    const companyId = req.params.id;

    // SAFETY: only update company_name if a name was actually provided
    const finalCompanyName =
      company_name !== undefined && company_name !== null && String(company_name).trim() !== ''
        ? company_name
        : name !== undefined && name !== null && String(name).trim() !== ''
        ? name
        : null;

    // 🔧 FIX: Ensure encryptedApiKey is always null or a valid encrypted string
    let encryptedApiKey = null;
    const apiKeyValue = ghl_api_key || ghlApiKey;

    console.log('🔑 Processing API Key:');
    console.log('  apiKeyValue:', apiKeyValue);
    console.log('  Is masked (***hidden***):', apiKeyValue === '***hidden***');
    console.log('  Is truthy:', !!apiKeyValue);

    if (apiKeyValue && apiKeyValue !== '***hidden***') {
      encryptedApiKey = encryptApiKey(apiKeyValue);
      console.log('  ✅ Encrypting API key');
      console.log(
        '  Encrypted value (first 30 chars):',
        encryptedApiKey ? encryptedApiKey.substring(0, 30) + '...' : 'NULL'
      );
    } else {
      console.log('  ⏭️  Skipping encryption (null or masked)');
    }

    const suspendedValue = suspended !== undefined ? suspended : null;
    const estimatorValue =
      estimator_enabled !== undefined
        ? estimator_enabled
        : estimatorEnabled !== undefined
        ? estimatorEnabled
        : null;

    const ghlLocationValue = ghl_location_id || ghlLocationId || null;
    const ghlInstallCalValue = ghl_install_calendar || ghlInstallCalendar || null;
    const ghlApptCalValue = ghl_appt_calendar || ghlApptCalendar || null;

    console.log('📝 SQL Parameters:');
    console.log(
      '  $11 (ghl_api_key):',
      encryptedApiKey ? encryptedApiKey.substring(0, 30) + '...' : 'NULL'
    );
    console.log('  $12 (ghl_location_id):', ghlLocationValue);
    console.log('  $13 (ghl_install_calendar):', ghlInstallCalValue);
    console.log('  $14 (ghl_appt_calendar):', ghlApptCalValue);

    const shouldUpdateEstimatorConfigs = [
      text_color,
      font_family,
      base_font_size,
      primary_button_color,
      primary_button_text_color,
      primary_button_radius,
      primary_button_hover_color,
      accent_color,
      muted_text_color,
      card_background_color,
      card_border_radius,
      card_shadow_strength,
      max_width,
      use_embedded_styles,
      disclaimer_text,
      min_job_info_text,
      standard_info_text,
      ty_url_redirect
    ].some((v) => v !== undefined);

    await client.query('BEGIN');

    // -----------------------------
    // Update companies (company-only)
    // -----------------------------
const companyResult = await client.query(
`UPDATE companies SET
  company_name = COALESCE($1, company_name),
  phone = COALESCE($2, phone),
  email = COALESCE($3, email),
  website = COALESCE($4, website),
  address = COALESCE($5, address),
  city = COALESCE($6, city),
  state = COALESCE($7, state),
  zip = COALESCE($8, zip),

  google_drive_base_folder_id = COALESCE($9, google_drive_base_folder_id),

  suspended = COALESCE($10, suspended),
  estimator_enabled = COALESCE($11, estimator_enabled),

  ghl_api_key = COALESCE($12, ghl_api_key),
  ghl_location_id = COALESCE($13, ghl_location_id),
  ghl_install_calendar = COALESCE($14, ghl_install_calendar),
  ghl_appt_calendar = COALESCE($15, ghl_appt_calendar),
  ghl_appt_assigned_user = COALESCE($16, ghl_appt_assigned_user),
  ghl_install_assigned_user = COALESCE($17, ghl_install_assigned_user),
  ghl_appt_title_template = COALESCE($18, ghl_appt_title_template),
  ghl_install_title_template = COALESCE($19, ghl_install_title_template),
  ghl_appt_description_template = COALESCE($20, ghl_appt_description_template),
  ghl_install_description_template = COALESCE($21, ghl_install_description_template),

  billing_status = COALESCE($22, billing_status),
  updated_at = CURRENT_TIMESTAMP
 WHERE id = $23 AND deleted_at IS NULL
 RETURNING *`
,
[
  finalCompanyName,                   // $1
  phone,                              // $2
  email,                              // $3
  website,                            // $4
  address,                            // $5
  city,                               // $6
  state,                              // $7
  zip,                                // $8

  google_drive_base_folder_id || null,// $9

  suspendedValue,                     // $10
  estimatorValue,                     // $11

  encryptedApiKey,                    // $12
  ghlLocationValue,                   // $13
  ghlInstallCalValue,                 // $14
  ghlApptCalValue,                    // $15
  ghl_appt_assigned_user || null,     // $16
  ghl_install_assigned_user || null,  // $17
  ghl_appt_title_template || null,    // $18
  ghl_install_title_template || null, // $19
  ghl_appt_description_template || null,// $20
  ghl_install_description_template || null,// $21

  billing_status,                     // $22
  companyId                           // $23
]

);

    if (companyResult.rows.length === 0) {
      await client.query('ROLLBACK');
      console.log('❌ Company not found');
      console.log('═══════════════════════════════════════');
      return res.status(404).json({ error: 'Company not found' });
    }

    console.log('✅ Company updated successfully');

    // -----------------------------
    // Update estimator_configs (only if estimator fields provided)
    // -----------------------------
    if (shouldUpdateEstimatorConfigs) {
      // first try UPDATE
      const ecUpdate = await client.query(
        `UPDATE estimator_configs SET
          text_color = COALESCE($1, text_color),
          font_family = COALESCE($2, font_family),
          base_font_size = CASE WHEN $3 IS NOT NULL THEN $3::int ELSE base_font_size END,
          primary_button_color = COALESCE($4, primary_button_color),
          primary_button_text_color = COALESCE($5, primary_button_text_color),
          primary_button_radius = CASE WHEN $6 IS NOT NULL THEN $6::int ELSE primary_button_radius END,
          primary_button_hover_color = COALESCE($7, primary_button_hover_color),
          accent_color = COALESCE($8, accent_color),
          muted_text_color = COALESCE($9, muted_text_color),
          card_background_color = COALESCE($10, card_background_color),
          card_border_radius = CASE WHEN $11 IS NOT NULL THEN $11::int ELSE card_border_radius END,
          card_shadow_strength = COALESCE($12, card_shadow_strength),
          max_width = CASE WHEN $13 IS NOT NULL THEN $13::int ELSE max_width END,
          use_embedded_styles = CASE WHEN $14 IS NOT NULL THEN $14::boolean ELSE use_embedded_styles END,
          disclaimer_text = COALESCE($15, disclaimer_text),
          min_job_info_text = COALESCE($16, min_job_info_text),
          standard_info_text = COALESCE($17, standard_info_text),
          ty_url_redirect = COALESCE($18, ty_url_redirect),
          updated_at = CURRENT_TIMESTAMP
         WHERE company_id = $19
         RETURNING id`,
        [
          text_color,
          font_family,
          base_font_size,
          primary_button_color,
          primary_button_text_color,
          primary_button_radius,
          primary_button_hover_color,
          accent_color,
          muted_text_color,
          card_background_color,
          card_border_radius,
          card_shadow_strength,
          max_width,
          use_embedded_styles,
          disclaimer_text,
          min_job_info_text,
          standard_info_text,
          ty_url_redirect,
          companyId
        ]
      );

      // if none, INSERT a row (minimal fields + defaults handled by DB)
      if (ecUpdate.rows.length === 0) {
        await client.query(
          `INSERT INTO estimator_configs (
            company_id,
            text_color,
            font_family,
            base_font_size,
            primary_button_color,
            primary_button_text_color,
            primary_button_radius,
            primary_button_hover_color,
            accent_color,
            muted_text_color,
            card_background_color,
            card_border_radius,
            card_shadow_strength,
            max_width,
            use_embedded_styles,
            disclaimer_text,
            min_job_info_text,
            standard_info_text,
            ty_url_redirect
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
          [
            companyId,
            text_color || null,
            font_family || null,
            base_font_size || null,
            primary_button_color || null,
            primary_button_text_color || null,
            primary_button_radius || null,
            primary_button_hover_color || null,
            accent_color || null,
            muted_text_color || null,
            card_background_color || null,
            card_border_radius || null,
            card_shadow_strength || null,
            max_width || null,
            use_embedded_styles !== undefined ? use_embedded_styles : null,
            disclaimer_text || null,
            min_job_info_text || null,
            standard_info_text || null,
            ty_url_redirect || null
          ]
        );
      }
    }

    await client.query('COMMIT');

    const company = companyResult.rows[0];
    company.ghl_api_key = company.ghl_api_key ? '***hidden***' : null;

    console.log('✅ Transaction committed, sending response');
    console.log('═══════════════════════════════════════');

    res.json({ company });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (e) {
      // ignore
    }
    console.error('❌ Update company error:', error);
    console.log('═══════════════════════════════════════');
    res.status(500).json({ error: 'Failed to update company' });
  } finally {
    client.release();
  }
});

// ============================================================================
// SOFT DELETE COMPANY
// ============================================================================
router.delete('/:id', requireRole('master'), async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE companies
       SET deleted_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    console.error('Delete company error:', error);
    res.status(500).json({ error: 'Failed to delete company' });
  }
});

module.exports = router;
module.exports.decryptApiKey = decryptApiKey;
