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
      // Update last_used and company assignment (master may switch companies)
      await db.query(
        'UPDATE device_tokens SET last_used = NOW(), company_id = $2, user_id = $3 WHERE device_token = $1',
        [deviceToken, companyId, userId]
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
 * Get notification preferences for the logged-in user
 * GET /api/push/notification-preferences
 */
router.get('/notification-preferences', async (req, res) => {
  try {
    const userId = req.user.id;

    let prefs = await getNotificationPreferences(userId);

    if (!prefs) {
      await db.query(
        `INSERT INTO notification_preferences (user_id) VALUES ($1)`,
        [userId]
      );
      prefs = await getNotificationPreferences(userId);
    }

    res.json(prefs);

  } catch (error) {
    console.error('Error getting notification preferences:', error);
    res.status(500).json({ error: 'Failed to get notification preferences' });
  }
});

/**
 * Update notification preferences for the logged-in user
 * PUT /api/push/notification-preferences
 */
router.put('/notification-preferences', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      notifyNewEstimatorLead,
      notifyNewLead,
      notifyMissedCall,
      notifyVoicemailLeft,
      notifyAppointmentReminder,
      notifyInstallReminder,
      notifyJobSold,
      notifyNewMessage,
    } = req.body;

    await db.query(
      `INSERT INTO notification_preferences
         (user_id, notify_new_estimator_lead, notify_new_lead, notify_missed_call,
          notify_voicemail_left, notify_appointment_reminder, notify_install_reminder,
          notify_job_sold, notify_new_message, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         notify_new_estimator_lead = $2,
         notify_new_lead = $3,
         notify_missed_call = $4,
         notify_voicemail_left = $5,
         notify_appointment_reminder = $6,
         notify_install_reminder = $7,
         notify_job_sold = $8,
         notify_new_message = $9,
         updated_at = NOW()`,
      [userId, notifyNewEstimatorLead, notifyNewLead, notifyMissedCall,
       notifyVoicemailLeft, notifyAppointmentReminder, notifyInstallReminder,
       notifyJobSold, notifyNewMessage]
    );

    console.log(`✅ Notification preferences updated for user ${userId}`);
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