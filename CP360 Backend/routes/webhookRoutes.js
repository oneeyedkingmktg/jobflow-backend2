const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const calendarWebhookController = require('../controllers/calendarWebhookController');
const { pool } = require('../config/database');
const { sendPushToCompany } = require('../services/pushNotificationService');

// GHL Contact webhook - single endpoint for all companies
router.post('/ghl/contact', webhookController.handleGHLContact);
router.post('/ghl/calendar', calendarWebhookController.handleGHLCalendar);

// Push notification trigger — called by GHL automations
router.post('/push', async (req, res) => {
  try {
    console.log('🔔 Push webhook received:', JSON.stringify(req.body));
    const { type, locationId, title, body, contactId } = req.body;

    if (!type || !locationId) {
      return res.status(400).json({ error: 'Missing type or locationId' });
    }

    // Look up company by GHL location ID
    const result = await pool.query(
      'SELECT id FROM companies WHERE ghl_location_id = $1',
      [locationId]
    );

    if (result.rows.length === 0) {
      console.log(`No company found for location_id: ${locationId}`);
      return res.status(404).json({ error: 'Company not found' });
    }

    const companyId = result.rows[0].id;

    const data = { type };
    if (contactId) data.contactId = String(contactId);

    await sendPushToCompany(companyId, { type, title, body, data });

    res.json({ success: true });
  } catch (error) {
    console.error('Push webhook error:', error);
    res.status(500).json({ error: 'Failed to send push notification' });
  }
});

module.exports = router;