// ============================================================================
// Companies Routes - Master admin company management (v2.1)
// FIX: Match actual DB schema - no ghl_calendar_id, use ghl_install_calendar & ghl_appt_calendar
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
// CREATE COMPANY (Simplified - matches actual DB schema)
// ============================================================================
router.post('/', async (req, res) => {
  try {
    const {
      company_name,
      name, // Accept either company_name or name
      phone,
      email,
      address,
      ghl_api_key,
      ghl_location_id,
      ghl_install_calendar,
      ghl_appt_calendar,
      billing_status,
      monthly_price
    } = req.body;

    const companyName = company_name || name;

    if (!companyName) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const encryptedApiKey = ghl_api_key ? encryptApiKey(ghl_api_key) : null;

    const result = await db.query(
      `INSERT INTO companies (
        company_name,
        phone,
        email,
        address,
        ghl_api_key,
        ghl_location_id,
        ghl_install_calendar,
        ghl_appt_calendar,
        billing_status,
        monthly_price
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        companyName,
        phone || null,
        email || null,
        address || null,
        encryptedApiKey,
        ghl_location_id || null,
        ghl_install_calendar || null,
        ghl_appt_calendar || null,
        billing_status || 'active',
        monthly_price || null
      ]
    );

    const company = result.rows[0];
    company.ghl_api_key = company.ghl_api_key ? '***hidden***' : null;

    res.status(201).json({ company });
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
      name, // Accept either company_name or name
      phone,
      email,
      address,
      ghl_api_key,
      ghl_location_id,
      ghl_install_calendar,
      ghl_appt_calendar,
      billing_status,
      monthly_price,
      setup_fee_paid
    } = req.body;

    const companyName = company_name || name;

    let encryptedApiKey = undefined;

    // Only encrypt if a new key is provided (not the hidden placeholder)
    if (ghl_api_key && ghl_api_key !== '***hidden***') {
      encryptedApiKey = encryptApiKey(ghl_api_key);
    }

    const result = await db.query(
      `UPDATE companies SET
        company_name = COALESCE($1, company_name),
        phone = COALESCE($2, phone),
        email = COALESCE($3, email),
        address = COALESCE($4, address),
        ghl_api_key = COALESCE($5, ghl_api_key),
        ghl_location_id = COALESCE($6, ghl_location_id),
        ghl_install_calendar = COALESCE($7, ghl_install_calendar),
        ghl_appt_calendar = COALESCE($8, ghl_appt_calendar),
        billing_status = COALESCE($9, billing_status),
        monthly_price = COALESCE($10, monthly_price),
        setup_fee_paid = COALESCE($11, setup_fee_paid),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $12 AND deleted_at IS NULL
       RETURNING *`,
      [
        companyName,
        phone,
        email,
        address,
        encryptedApiKey,
        ghl_location_id,
        ghl_install_calendar,
        ghl_appt_calendar,
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
