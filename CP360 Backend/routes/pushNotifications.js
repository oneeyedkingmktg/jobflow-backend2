const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { sendTestPush, getNotificationPreferences } = require('../services/pushNotificationService');

/**
 * Register device token for push notifications
 * POST /api/register-device
 */
router.post('/register-device', async (req, res) => {
  try {
    const { userId, companyId, deviceToken, platform } = req.body;

    if (!userId || !companyId || !deviceToken || !platform) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, companyId, deviceToken, platform' 
      });
    }

    // Check if token already exists
    const existing = await db.query(
      'SELECT * FROM device_tokens WHERE device_token = $1',
      [deviceToken]
    );

    if (existing.rows.length > 0) {
      // Update last_used timestamp
      await db.query(
        'UPDATE device_tokens SET last_used = NOW() WHERE device_token = $1',
        [deviceToken]
      );
      return res.json({ message: 'Device token updated', existing: true });
    }

    // Insert new token
    await db.query(
      'INSERT INTO device_tokens (user_id, company_id, device_token, platform) VALUES ($1, $2, $3, $4)',
      [userId, companyId, deviceToken, platform]
    );

    console.log(`✅ New device registered: ${platform} for user ${userId}`);
    res.json({ message: 'Device registered successfully', existing: false });

  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

/**
 * Get notification preferences for a company
 * GET /api/notification-preferences/:companyId
 */
router.get('/notification-preferences/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;

    const prefs = await getNotificationPreferences(companyId);

    if (!prefs) {
      // Create default preferences if none exist
      await db.query(
        `INSERT INTO notification_preferences (company_id) VALUES ($1)`,
        [companyId]
      );
      
      const newPrefs = await getNotificationPreferences(companyId);
      return res.json(newPrefs);
    }

    res.json(prefs);

  } catch (error) {
    console.error('Error getting notification preferences:', error);
    res.status(500).json({ error: 'Failed to get notification preferences' });
  }
});

/**
 * Update notification preferences
 * PUT /api/notification-preferences/:companyId
 */
router.put('/notification-preferences/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const {
      notifyNewLead,
      notifyAppointmentReminder,
      notifyJobSold,
      notifyJobComplete,
      notifyPaymentReceived
    } = req.body;

    await db.query(
      `UPDATE notification_preferences 
       SET notify_new_lead = $1,
           notify_appointment_reminder = $2,
           notify_job_sold = $3,
           notify_job_complete = $4,
           notify_payment_received = $5,
           updated_at = NOW()
       WHERE company_id = $6`,
      [notifyNewLead, notifyAppointmentReminder, notifyJobSold, notifyJobComplete, notifyPaymentReceived, companyId]
    );

    console.log(`✅ Notification preferences updated for company ${companyId}`);
    res.json({ message: 'Preferences updated successfully' });

  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

/**
 * Send test push notification
 * POST /api/test-push
 */
router.post('/test-push', async (req, res) => {
  try {
    const { companyId, userId } = req.body;

    if (!companyId || !userId) {
      return res.status(400).json({ error: 'Missing companyId or userId' });
    }

    const result = await sendTestPush(companyId, userId);

    if (result.success) {
      res.json({ 
        message: 'Test notification sent!',
        successCount: result.successCount 
      });
    } else {
      res.status(400).json({ 
        error: 'Failed to send test notification',
        reason: result.reason 
      });
    }

  } catch (error) {
    console.error('Error sending test push:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

module.exports = router;