const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const calendarWebhookController = require('../controllers/calendarWebhookController');
const { pool } = require('../config/database');
const { sendPushToCompany } = require('../services/pushNotificationService');
const verifyGHLWebhook = require('../middleware/verifyGHLWebhook');

// GHL Contact webhook - single endpoint for all companies
router.post('/ghl/contact', verifyGHLWebhook, webhookController.handleGHLContact);
router.post('/ghl/calendar', verifyGHLWebhook, calendarWebhookController.handleGHLCalendar);

// Message-arrived — called by GHL automation on any inbound message
router.post('/message-arrived', async (req, res) => {
  try {
    const raw = req.body || {};
    const payload = raw.customData || raw;
    const locationId = payload.locationId || payload.location_id;
    const contactId = payload.contactId || payload.contact_id;

    console.log('📨 message-arrived webhook:', { locationId, contactId, keys: Object.keys(payload) });

    if (!locationId || !contactId) {
      console.warn('📨 message-arrived: missing fields, full body:', JSON.stringify(raw));
      return res.status(400).json({ error: 'Missing locationId or contactId' });
    }

    const result = await pool.query(
      'SELECT id FROM companies WHERE ghl_location_id = $1',
      [locationId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const companyId = result.rows[0].id;
    await pool.query(
      `INSERT INTO conversation_updates (contact_id, company_id, last_message_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (contact_id)
       DO UPDATE SET last_message_at = NOW(), company_id = EXCLUDED.company_id`,
      [contactId, companyId]
    );

    console.log('📨 message-arrived: stored update for contact', contactId, 'company', companyId);
    res.json({ success: true });
  } catch (error) {
    console.error('Message-arrived webhook error:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Push notification trigger — called by GHL automations
router.post('/push', async (req, res) => {
  try {
    console.log('🔔 Push webhook received:', JSON.stringify(req.body));
    const payload = req.body.customData || req.body;
    const { type, locationId, title, contactId } = payload;
    // GHL sends contact_id (snake_case) at the root level of the webhook body
    const ghlContactId = contactId || req.body.contact_id;
    const contactName = req.body.full_name || req.body.contact?.full_name || '';
    const body = contactName
      ? `${contactName} ${payload.body || ''}`.trim()
      : payload.body || '';
    console.log('🔔 Parsed payload:', { type, locationId, title, body, ghlContactId });

    if (!type || !locationId) {
      return res.status(400).json({ error: 'Missing type or locationId' });
    }

    // Look up company by GHL location ID
    console.log('🔔 Looking up company for locationId:', locationId);
    const result = await pool.query(
      'SELECT id FROM companies WHERE ghl_location_id = $1',
      [locationId]
    );
    console.log('🔔 Company lookup result:', result.rows);

    if (result.rows.length === 0) {
      console.log(`No company found for location_id: ${locationId}`);
      return res.status(404).json({ error: 'Company not found' });
    }

    const companyId = result.rows[0].id;
    console.log('🔔 Sending push for companyId:', companyId);

    const data = { type };
    if (ghlContactId) data.contactId = String(ghlContactId);

    await sendPushToCompany(companyId, { type, title, body, data });

    res.json({ success: true });
  } catch (error) {
    console.error('Push webhook error:', error);
    res.status(500).json({ error: 'Failed to send push notification' });
  }
});

module.exports = router;