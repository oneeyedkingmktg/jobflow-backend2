const { getMessaging } = require('../config/firebase');
const db = require('../config/database'); // Your existing database connection

/**
 * Send push notification to all devices for a company
 */
async function sendPushToCompany(companyId, notification) {
  try {
    // Check if notifications are enabled for this type
    const prefs = await getNotificationPreferences(companyId);
    if (!prefs || !shouldSendNotification(prefs, notification.type)) {
      console.log(`Push notification ${notification.type} disabled for company ${companyId}`);
      return { success: false, reason: 'disabled' };
    }

    // Get all device tokens for this company
    const tokens = await getCompanyDeviceTokens(companyId);
    if (tokens.length === 0) {
      console.log(`No device tokens found for company ${companyId}`);
      return { success: false, reason: 'no_tokens' };
    }

    // Send to Firebase Cloud Messaging
    const messaging = getMessaging();
    if (!messaging) {
      console.error('Firebase messaging not initialized');
      return { success: false, reason: 'firebase_not_initialized' };
    }

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      tokens: tokens,
    };

    const response = await messaging.sendEachForMulticast(message);
    
    console.log(`✅ Push sent to ${response.successCount}/${tokens.length} devices`);
    
    // Clean up failed tokens
    if (response.failureCount > 0) {
      await cleanupFailedTokens(response.responses, tokens);
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
 * Get notification preferences for a company
 */
async function getNotificationPreferences(companyId) {
  const result = await db.query(
    'SELECT * FROM notification_preferences WHERE company_id = $1',
    [companyId]
  );
  return result.rows[0];
}

/**
 * Check if notification type should be sent based on preferences
 */
function shouldSendNotification(prefs, type) {
  const typeMap = {
    'new_lead': prefs.notify_new_lead,
    'appointment_reminder': prefs.notify_appointment_reminder,
    'job_sold': prefs.notify_job_sold,
    'job_complete': prefs.notify_job_complete,
    'payment_received': prefs.notify_payment_received,
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