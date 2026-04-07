import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { isNativeApp, getPlatform } from '../utils/platform';
import { apiRequest } from '../api';

/**
 * Setup push notification listeners — call at app startup, before auth
 */
export const setupPushListeners = () => {
  if (!isNativeApp()) return;

  // Listen for push notifications received (foreground)
  FirebaseMessaging.addListener('notificationReceived', (event) => {
    console.log('📬 Push notification received:', event.notification);
  });

  // Listen for push notification tapped — deep link to contact record
  FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
    console.log('📬 Full action object:', JSON.stringify(event));
    const data = event.notification.data || {};
    console.log('📬 Push notification tapped:', data);

    if (data.contactId) {
      window.__pendingGhlContactId = data.contactId;

      // Retry navigation until React has rendered and __setAppScreen is available
      // (handles cold-start where this fires before the app renders)
      const tryNavigate = (attempts = 0) => {
        if (typeof window.__setAppScreen === 'function') {
          window.__setAppScreen('leads');
          window.dispatchEvent(new CustomEvent('openLeadByGhlContact', { detail: { ghlContactId: data.contactId } }));
        } else if (attempts < 20) {
          setTimeout(() => tryNavigate(attempts + 1), 250);
        }
      };
      tryNavigate();
    }

    if (data.leadId) {
      const leadId = parseInt(data.leadId);
      window.__pendingLeadId = leadId;

      const tryNavigate = (attempts = 0) => {
        if (typeof window.__setAppScreen === 'function') {
          window.__setAppScreen('leads');
          window.dispatchEvent(new CustomEvent('openLeadById', { detail: { leadId } }));
        } else if (attempts < 20) {
          setTimeout(() => tryNavigate(attempts + 1), 250);
        }
      };
      tryNavigate();
    }
  });
};

/**
 * Initialize push notifications and register device — call after auth
 */
export const initializePushNotifications = async (user) => {
  if (!isNativeApp()) {
    console.log('Push notifications only available in native app');
    return { success: false, reason: 'not_native' };
  }

  try {
    const permissionStatus = await FirebaseMessaging.requestPermissions();

    if (permissionStatus.receive !== 'granted') {
      console.log('Push notification permission denied');
      return { success: false, reason: 'permission_denied' };
    }

    const { token } = await FirebaseMessaging.getToken();
    console.log('✅ Push registration success, token:', token);
    await registerDeviceToken(user, token);

    FirebaseMessaging.addListener('tokenReceived', async (event) => {
      console.log('🔄 Push token refreshed:', event.token);
      await registerDeviceToken(user, event.token);
    });

return { success: true };

  } catch (error) {
    console.error('Error initializing push notifications:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Re-register device token under a different company — for master switching context
 */
export const switchNotificationCompany = async (user, companyId) => {
  if (!isNativeApp()) return;
  try {
    const { token } = await FirebaseMessaging.getToken();
    const platform = getPlatform();
    await apiRequest('/api/push/register-device', {
      method: 'POST',
      body: JSON.stringify({
        userId: user.id,
        companyId: companyId,
        deviceToken: token,
        platform: platform
      })
    });
    console.log(`✅ Notification company switched to ${companyId}`);
  } catch (error) {
    console.error('❌ Failed to switch notification company:', error);
  }
};

/**
 * Send device token to backend
 */
const registerDeviceToken = async (user, deviceToken) => {
  try {
    const platform = getPlatform();

    const data = await apiRequest('/api/push/register-device', {
      method: 'POST',
      body: JSON.stringify({
        userId: user.id,
        companyId: user.company_id || user.companyId,
        deviceToken: deviceToken,
        platform: platform
      })
    });

    console.log('✅ Device token registered with backend');
    return data;

  } catch (error) {
    console.error('❌ Failed to register device token with backend:', error);
    throw error;
  }
};

/**
 * Get notification preferences for the logged-in user
 */
export const getNotificationPreferences = async () => {
  try {
    const data = await apiRequest('/api/push/notification-preferences');
    return data;
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    throw error;
  }
};

/**
 * Update notification preferences for the logged-in user
 */
export const updateNotificationPreferences = async (preferences) => {
  try {
    const data = await apiRequest('/api/push/notification-preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences)
    });
    return data;
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    throw error;
  }
};

/**
 * Send test push notification
 */
export const sendTestPush = async (companyId, userId) => {
  try {
    const data = await apiRequest('/api/push/test-push', {
      method: 'POST',
      body: JSON.stringify({ companyId, userId })
    });
    return data;
  } catch (error) {
    console.error('Error sending test push:', error);
    throw error;
  }
};
