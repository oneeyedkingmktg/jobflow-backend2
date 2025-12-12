// ============================================================================
// Companies Routes - Master admin company management
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
      ghl_api_key,
      ghl_location_id,
      ghl_calendar_id,
      billing_status,
      monthly_price,
      admin_email,
      admin_password,
      admin_name,
      admin_phone
    } = req.body;

    if (!company_name || !admin_email || !admin_password || !admin_name) {
      return res
        .status(400)
        .json({ error: 'Company name, admin email, password, and name are required' });
    }

    const existingUser = await db.query(
      `SELECT id FROM users WHERE email = $1`,
      [admin_email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Admin email already registered' });
    }

    const encryptedApiKey = ghl_api_key ? encryptApiKey(ghl_api_key) : null;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const companyResult = await client.query(
        `INSERT INTO companies (
          company_name,
          ghl_api_key,
          ghl_location_id,
          ghl_calendar_id,
          billing_status,
          monthly_price
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          company_name,
          encryptedApiKey,
          ghl_location_id,
          ghl_calendar_id,
          billing_status || 'trial',
          monthly_price
        ]
      );

      const company = companyResult.rows[0];

      const passwordHash = await bcrypt.hash(admin_password, 10);

      const userResult = await client.query(
        `INSERT INTO users (
          company_id,
          email,
          password_hash,
          name,
          phone,
          role,
          created_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, 'admin', $6)
        RETURNING id, email, name, phone, role`,
        [
          company.id,
          admin_email.toLowerCase(),
          passwordHash,
          admin_name,
          admin_phone,
          req.user.id
        ]
      );

      await client.query('COMMIT');

      res.status(201).json({
        company: {
          ...company,
          ghl_api_key: company.ghl_api_key ? '***hidden***' : null
        },
        admin_user: userResult.rows[0]
      });
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
      ghl_api_key,
      ghl_location_id,
      ghl_calendar_id,
      billing_status,
      monthly_price,
      setup_fee_paid
    } = req.body;

    let encryptedApiKey = undefined;

    if (ghl_api_key && ghl_api_key !== '***hidden***') {
      encryptedApiKey = encryptApiKey(ghl_api_key);
    }

    const result = await db.query(
      `UPDATE companies SET
        company_name = COALESCE($1, company_name),
        ghl_api_key = COALESCE($2, ghl_api_key),
        ghl_location_id = COALESCE($3, ghl_location_id),
        ghl_calendar_id = COALESCE($4, ghl_calendar_id),
        billing_status = COALESCE($5, billing_status),
        monthly_price = COALESCE($6, monthly_price),
        setup_fee_paid = COALESCE($7, setup_fee_paid),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 AND deleted_at IS NULL
       RETURNING *`,
      [
        company_name,
        encryptedApiKey,
        ghl_location_id,
        ghl_calendar_id,
        billing_status,
        monthly_price,
        setup_fee_paid,
        req.params.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const company = result.rows[0];
    company.ghl_api_key = company.ghl_api_key ? '***hidden***' : null;

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
