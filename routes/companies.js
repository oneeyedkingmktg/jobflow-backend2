// ============================================================================
// File: routes/companies.js
// Version: v2.5 - CRITICAL: Fix boolean handling (suspended, estimator_enabled)
// ============================================================================
const express = require('express');
const bcrypt = require('bcryptjs');
const CryptoJS = require('crypto-js');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);
router.use(requireRole('master'));

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

    const companies = result.rows.map((company) => ({
      ...company,
      ghl_api_key: company.ghl_api_key ? '***hidden***' : null
    }));

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
    company.ghl_api_key = company.ghl_api_key ? '***hidden***' : null;

    res.json({ company });
  } catch (error) {
    console.error('Get company error:', error);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// ============================================================================
// CREATE COMPANY + ADMIN USER
// ============================================================================
router.post('/', async (req, res) => {
  try {
    const {
      company_name,
      name, // Accept both formats
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

    // Only require admin details if provided (simplified creation)
    const encryptedApiKey = ghl_api_key && ghl_api_key !== '***hidden***' 
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
          estimator_enabled,
          billing_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
          estimator_enabled || false,
          billing_status || 'active'
        ]
      );

      const company = companyResult.rows[0];

      // Create admin user if details provided
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
          VALUES ($1, $2, $3, $4, $5, 'admin', true)`,
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
// UPDATE COMPANY
// ============================================================================
router.put('/:id', async (req, res) => {
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
      ghlApiKey,
      ghl_location_id,
      ghlLocationId,
      ghl_install_calendar,
      ghlInstallCalendar,
      ghl_appt_calendar,
      ghlApptCalendar,
      estimator_enabled,
      estimatorEnabled,
      billing_status
    } = req.body;

    console.log("UPDATE COMPANY - Body received:", JSON.stringify(req.body, null, 2));

    const finalCompanyName = company_name || name;

    // Handle API key encryption
    let encryptedApiKey = undefined;
    const apiKeyValue = ghl_api_key || ghlApiKey;
    
    if (apiKeyValue && apiKeyValue !== '***hidden***') {
      encryptedApiKey = encryptApiKey(apiKeyValue);
    }

    // CRITICAL: Handle booleans explicitly (false is a valid value!)
    const suspendedValue = suspended !== undefined ? suspended : undefined;
    const estimatorValue = estimator_enabled !== undefined ? estimator_enabled : 
                          (estimatorEnabled !== undefined ? estimatorEnabled : undefined);

    console.log("Boolean values - suspended:", suspendedValue, "estimator_enabled:", estimatorValue);

    const result = await db.query(
      `UPDATE companies SET
        company_name = COALESCE($1, company_name),
        phone = COALESCE($2, phone),
        email = COALESCE($3, email),
        website = COALESCE($4, website),
        address = COALESCE($5, address),
        city = COALESCE($6, city),
        state = COALESCE($7, state),
        zip = COALESCE($8, zip),
        suspended = CASE WHEN $9::boolean IS NOT NULL THEN $9::boolean ELSE suspended END,
        ghl_api_key = COALESCE($10, ghl_api_key),
        ghl_location_id = COALESCE($11, ghl_location_id),
        ghl_install_calendar = COALESCE($12, ghl_install_calendar),
        ghl_appt_calendar = COALESCE($13, ghl_appt_calendar),
        estimator_enabled = CASE WHEN $14::boolean IS NOT NULL THEN $14::boolean ELSE estimator_enabled END,
        billing_status = COALESCE($15, billing_status),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $16 AND deleted_at IS NULL
       RETURNING *`,
      [
        finalCompanyName,
        phone,
        email,
        website,
        address,
        city,
        state,
        zip,
        suspendedValue,
        encryptedApiKey,
        ghl_location_id || ghlLocationId,
        ghl_install_calendar || ghlInstallCalendar,
        ghl_appt_calendar || ghlApptCalendar,
        estimatorValue,
        billing_status,
        req.params.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const company = result.rows[0];
    company.ghl_api_key = company.ghl_api_key ? '***hidden***' : null;

    console.log("UPDATE COMPANY - Result:", JSON.stringify(company, null, 2));

    res.json({ company });
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

// ============================================================================
// SOFT DELETE COMPANY
// ============================================================================
router.delete('/:id', async (req, res) => {
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
