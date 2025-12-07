// routes/ghl.js

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const ghl = require('../controllers/ghlAPI');

// VERIFY COMPANY + LOAD COMPANY RECORD
async function loadCompany(req, res, next) {
  const companyId = req.headers['x-company-id'];

  if (!companyId) {
    return res.status(400).json({ error: 'Missing x-company-id header' });
  }

  try {
    const result = await db.query('SELECT * FROM companies WHERE id = $1', [
      companyId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    req.company = result.rows[0];
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Database error' });
  }
}

// SEARCH CONTACT BY PHONE
router.get('/search-by-phone', loadCompany, async (req, res) => {
  try {
    const phone = req.query.phone || '';
    const result = await ghl.searchGHLContactByPhone(phone, req.company);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Search failed' });
  }
});

// SYNC LEAD INTO GHL
router.post('/sync-lead', loadCompany, async (req, res) => {
  try {
    const lead = req.body;

    if (!lead || !lead.id) {
      return res.status(400).json({ error: 'Invalid lead payload' });
    }

    const contact = await ghl.syncLeadToGHL(lead, req.company);

    return res.json({
      status: 'success',
      contact,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Sync failed' });
  }
});

// GET CONTACT BY ID
router.get('/contact/:id', loadCompany, async (req, res) => {
  try {
    const contact = await ghl.fetchGHLContact(req.params.id, req.company);
    return res.json(contact);
  } catch (err) {
    return res.status(500).json({ error: 'Fetch failed' });
  }
});

module.exports = router;
