// ============================================================================
// Leads Routes - CRUD operations with GHL sync
// ============================================================================
const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireSameCompany } = require('../middleware/auth');
const ghlAPI = require('../controllers/ghlAPI');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================================================
// GET /api/leads - Get all leads for user's company
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const { status, search } = req.query;
    const companyId = req.user.company_id;

    let query = `
      SELECT * FROM leads 
      WHERE company_id = $1
    `;
    const params = [companyId];

    // Filter by status
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    // Search by name or phone
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (name ILIKE $${params.length} OR phone ILIKE $${params.length})`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    res.json({ leads: result.rows });
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// ============================================================================
// GET /api/leads/:id - Get single lead
// ============================================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    const result = await db.query(
      'SELECT * FROM leads WHERE id = $1 AND company_id = $2',
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({ lead: result.rows[0] });
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// ============================================================================
// POST /api/leads - Create new lead
// ============================================================================
router.post('/', async (req, res) => {
  try {
    const leadData = req.body;
    const companyId = req.user.company_id;
    const userId = req.user.id;

    console.log('Creating lead for company:', companyId, 'user:', userId);
    console.log('Lead data:', leadData);

    // Check for duplicate by phone number
    const duplicate = await db.query(
      'SELECT id FROM leads WHERE company_id = $1 AND phone = $2',
      [companyId, leadData.phone]
    );

    if (duplicate.rows.length > 0) {
      return res.status(400).json({ error: 'Lead with this phone number already exists' });
    }

    // Insert lead into database
    const result = await db.query(
      `INSERT INTO leads (
        company_id, created_by_user_id, name, phone, email, address, city, state, zip,
        buyer_type, company_name, project_type, lead_source, status, not_sold_reason,
        contract_price, appointment_date, preferred_contact, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,
      [
        companyId, userId, leadData.name, leadData.phone, leadData.email,
        leadData.address, leadData.city, leadData.state, leadData.zip,
        leadData.buyer_type, leadData.company_name, leadData.project_type,
        leadData.lead_source, leadData.status || 'lead', leadData.not_sold_reason,
        leadData.contract_price, leadData.appointment_date, leadData.preferred_contact,
        leadData.notes
      ]
    );

    const newLead = result.rows[0];
    console.log('Lead created successfully:', newLead.id);

    // Sync to GHL in background (don't wait for it)
    ghlAPI.syncLeadToGHL(newLead, companyId).catch(err => {
      console.error('GHL sync error:', err);
    });

    res.status(201).json({ lead: newLead });
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ error: 'Failed to create lead', details: error.message });
  }
});

// ============================================================================
// PUT /api/leads/:id - Update lead
// ============================================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const leadData = req.body;
    const companyId = req.user.company_id;

    // Verify lead belongs to user's company
    const existing = await db.query(
      'SELECT * FROM leads WHERE id = $1 AND company_id = $2',
      [id, companyId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Update lead
    const result = await db.query(
      `UPDATE leads SET
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        email = COALESCE($3, email),
        address = COALESCE($4, address),
        city = COALESCE($5, city),
        state = COALESCE($6, state),
        zip = COALESCE($7, zip),
        buyer_type = COALESCE($8, buyer_type),
        company_name = COALESCE($9, company_name),
        project_type = COALESCE($10, project_type),
        lead_source = COALESCE($11, lead_source),
        status = COALESCE($12, status),
        not_sold_reason = COALESCE($13, not_sold_reason),
        contract_price = COALESCE($14, contract_price),
        appointment_date = COALESCE($15, appointment_date),
        preferred_contact = COALESCE($16, preferred_contact),
        notes = COALESCE($17, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $18 AND company_id = $19
      RETURNING *`,
      [
        leadData.name, leadData.phone, leadData.email, leadData.address, leadData.city,
        leadData.state, leadData.zip, leadData.buyer_type, leadData.company_name,
        leadData.project_type, leadData.lead_source, leadData.status, leadData.not_sold_reason,
        leadData.contract_price, leadData.appointment_date, leadData.preferred_contact,
        leadData.notes, id, companyId
      ]
    );

    const updatedLead = result.rows[0];

    // Sync to GHL in background
    ghlAPI.syncLeadToGHL(updatedLead, companyId).catch(err => {
      console.error('GHL sync error:', err);
    });

    res.json({ lead: updatedLead });
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// ============================================================================
// DELETE /api/leads/:id - Delete lead (hard delete since no deleted_at column)
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    const result = await db.query(
      'DELETE FROM leads WHERE id = $1 AND company_id = $2 RETURNING id',
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

module.exports = router;
