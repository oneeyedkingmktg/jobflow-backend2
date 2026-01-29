const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// GHL Contact webhook - single endpoint for all companies
router.post('/ghl/contact', webhookController.handleGHLContact);

module.exports = router;