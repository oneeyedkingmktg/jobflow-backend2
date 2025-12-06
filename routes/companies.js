// ============================================================================
// Companies Routes - Master admin company management
// ============================================================================
const express = require('express');
const bcrypt = require('bcryptjs');
const CryptoJS = require('crypto-js');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require master role
router.use(authenticateToken);
router.use(requireRole('master'));

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'change-this-encryption-key';

// Helper: Encrypt API key
const encryptApiKey = (apiKey) => {
  return CryptoJS.AES.encrypt(apiKey, ENCRYPTION_KEY).toString();
};

// Helper: Decrypt API key
const decryptApiKey = (encryptedKey) => {
  const bytes = CryptoJS.AES.decrypt(encryptedKey, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// ============================================================================
// GET /api/companies - Get all companies
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        c.*,
        COUNT(DISTINCT u.id) as user_count,
        COUNT(DISTINCT l.id) as lead_count
       FROM companies c
       LEFT JOIN users u ON c.id = u.company_id AND u.deleted_at IS NULL
       LEFT JOIN leads l ON c.id = l.company_id AND l.deleted_at IS NULL
       WHERE c.deleted_at IS NULL
       GROUP BY c.id
       ORDER BY c.created_at DESC`
    );

    // Remove encrypted API keys from response
    const companies = result.rows.map(company => ({
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
// GET /api/companies/:id - Get single company
// ============================================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM companies WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const company = result.rows[0];
    
    // Hide encrypted API key
    company.ghl_api_key = company.ghl_api_key ? '***hidden***' : null;

    res.json({ company });
  } catch (error) {
    console.error('Get company error:', error);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// ============================================================================
// POST /api/companies - Create new company (onboard contractor)
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

    // Validation
    if (!company_name || !admin_email || !admin_password || !admin_name) {
      return res.status(400).json({ 
        error: 'Company name, admin email, password, and name are required' 
      });
    }

    // Check if admin email already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [admin_email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Admin email already registered' });
    }

    // Encrypt GHL API key if provided
    const encryptedApiKey = ghl_api_key ? encryptApiKey(ghl_api_key) : null;

    // Start transaction
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Create company
      const companyResult = await client.query(
        `INSERT INTO companies (
          company_name, ghl_api_key, ghl_location_id, ghl_calendar_id, 
          billing_status, monthly_price
        ) VALUES ($1, $2, $3, $4, $5, $6)
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

      // Hash admin password
      const passwordHash = await bcrypt.hash(admin_password, 10);

      // Create admin user
      const userResult = await client.query(
        `INSERT INTO users (
          company_id, email, password_hash, name, phone, role, created_by_user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, email, name, phone, role`,
        [
          company.id,
          admin_email.toLowerCase(),
          passwordHash,
          admin_name,
          admin_phone,
          'admin',
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
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create company error:', error);
    res.status(500).json({ error: 'Failed to create company' });
  }
});

// ============================================================================
// PUT /api/companies/:id - Update company
// ============================================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      company_name,
      ghl_api_key,
      ghl_location_id,
      ghl_calendar_id,
      billing_status,
      monthly_price,
      setup_fee_paid
    } = req.body;

    // Encrypt GHL API key if provided and not the placeholder
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
       WHERE id = $8
       RETURNING *`,
      [
        company_name,
        encryptedApiKey,
        ghl_location_id,
        ghl_calendar_id,
        billing_status,
        monthly_price,
        setup_fee_paid,
        id
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
// DELETE /api/companies/:id - Delete company (soft delete)
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'UPDATE companies SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
      [id]
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
module.exports.decryptApiKey = decryptApiKey; // Export for use in GHL API
