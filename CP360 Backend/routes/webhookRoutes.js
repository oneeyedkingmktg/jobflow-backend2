const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const calendarWebhookController = require('../controllers/calendarWebhookController');


// GHL Contact webhook - single endpoint for all companies
router.post('/ghl/contact', webhookController.handleGHLContact);
router.post('/ghl/calendar', calendarWebhookController.handleGHLCalendar);

module.exports = router;