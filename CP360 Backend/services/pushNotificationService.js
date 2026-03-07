const { getMessaging } = require('../config/firebase');
const db = require('../config/database'); // Your existing database connection

/**
 * Send push notification to all devices for a company
 */
async function sendPushToCompany(companyId, notification) {
  try {
    const messaging = getMessaging();
    if (!messaging) {
      console.error('Firebase messaging not initialized');
      return { success: false, reason: 'firebase_not_initialized' };
    }

    // Get all device tokens for this company, grouped by user
    const result = await db.query(
      'SELECT user_id, device_token FROM device_tokens WHERE company_id = $1',
      [companyId]
    );

    if (result.rows.length === 0) {
      console.log(`No device tokens found for company ${companyId}`);
      return { success: false, reason: 'no_tokens' };
    }

    // Filter tokens to only users who have this notification type enabled
    const eligibleTokens = [];
    for (const row of result.rows) {
      const prefs = await getNotificationPreferences(row.user_id);
      if (!prefs) {
        // No prefs set yet — default is ON, include them
        eligibleTokens.push(row.device_token);
      } else if (shouldSendNotification(prefs, notification.type)) {
        eligibleTokens.push(row.device_token);
      }
    }

    if (eligibleTokens.length === 0) {
      console.log(`Push notification ${notification.type} disabled by all users for company ${companyId}`);
      return { success: false, reason: 'disabled' };
    }

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      tokens: eligibleTokens,
    };

    const response = await messaging.sendEachForMulticast(message);

    console.log(`✅ Push sent to ${response.successCount}/${eligibleTokens.length} devices`);

    if (response.failureCount > 0) {
      await cleanupFailedTokens(response.responses, eligibleTokens);
    }

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get notification preferences for a user
 */
async function getNotificationPreferences(userId) {
  const result = await db.query(
    'SELECT * FROM notification_preferences WHERE user_id = $1',
    [userId]
  );
  return result.rows[0];
}

/**
 * Check if notification type should be sent based on preferences
 */
function shouldSendNotification(prefs, type) {
  const typeMap = {
    'new_estimator_lead': prefs.notify_new_estimator_lead,
    'new_lead': prefs.notify_new_lead,
    'missed_call': prefs.notify_missed_call,
    'voicemail_left': prefs.notify_voicemail_left,
    'appointment_reminder': prefs.notify_appointment_reminder,
    'install_reminder': prefs.notify_install_reminder,
    'job_sold': prefs.notify_job_sold,
    'new_message': prefs.notify_new_message,
  };
  return typeMap[type] !== false;
}

/**
 * Get all device tokens for a company
 */
async function getCompanyDeviceTokens(companyId) {
  const result = await db.query(
    'SELECT device_token FROM device_tokens WHERE company_id = $1',
    [companyId]
  );
  return result.rows.map(row => row.device_token);
}

/**
 * Clean up failed/invalid tokens
 */
async function cleanupFailedTokens(responses, tokens) {
  const failedTokens = [];
  responses.forEach((resp, idx) => {
    if (!resp.success) {
      failedTokens.push(tokens[idx]);
    }
  });

  if (failedTokens.length > 0) {
    await db.query(
      'DELETE FROM device_tokens WHERE device_token = ANY($1)',
      [failedTokens]
    );
    console.log(`🗑️  Cleaned up ${failedTokens.length} failed tokens`);
  }
}

/**
 * Send test push notification
 */
async function sendTestPush(companyId, userId) {
  return sendPushToCompany(companyId, {
    type: 'test',
    title: '🎉 Test Notification',
    body: 'Push notifications are working! You\'ll receive alerts for new leads, appointments, and more.',
    data: {
      type: 'test',
      timestamp: new Date().toISOString(),
    },
  });
}

module.exports = {
  sendPushToCompany,
  sendTestPush,
  getNotificationPreferences,
};