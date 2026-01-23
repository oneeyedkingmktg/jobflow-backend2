import { PushNotifications } from '@capacitor/push-notifications';
import { isNativeApp, getPlatform } from '../utils/platform';
import { apiRequest } from '../api';

/**
 * Initialize push notifications and register device
 */
export const initializePushNotifications = async (user) => {
  // Only run on native platforms
  if (!isNativeApp()) {
    console.log('Push notifications only available in native app');
    return { success: false, reason: 'not_native' };
  }

  try {
    // Request permission
    const permissionStatus = await PushNotifications.requestPermissions();
    
    if (permissionStatus.receive !== 'granted') {
      console.log('Push notification permission denied');
      return { success: false, reason: 'permission_denied' };
    }

    // Register with FCM
    await PushNotifications.register();

    // Listen for registration success
    PushNotifications.addListener('registration', async (token) => {
      console.log('✅ Push registration success, token:', token.value);
      
      // Send token to backend
      await registerDeviceToken(user, token.value);
    });

    // Listen for registration error
    PushNotifications.addListener('registrationError', (error) => {
      console.error('❌ Push registration error:', error);
    });

    // Listen for push notifications received
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('📬 Push notification received:', notification);
    });

    // Listen for push notification tapped
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('📬 Push notification tapped:', notification);
    });

    return { success: true };

  } catch (error) {
    console.error('Error initializing push notifications:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send device token to backend
 */
const registerDeviceToken = async (user, deviceToken) => {
  try {
    const platform = getPlatform();
    
    const response = await apiRequest('/api/push/register-device', {
      method: 'POST',
      body: JSON.stringify({
        userId: user.id,
        companyId: user.company_id || user.companyId,
        deviceToken: deviceToken,
        platform: platform
      })
    });

    const data = await response.json();
    console.log('✅ Device token registered with backend');
    return data;

  } catch (error) {
    console.error('❌ Failed to register device token with backend:', error);
    throw error;
  }
};

/**
 * Get notification preferences
 */
export const getNotificationPreferences = async (companyId) => {
  try {
    const response = await apiRequest(`/api/push/notification-preferences/${companyId}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    throw error;
  }
};

/**
 * Update notification preferences
 */
export const updateNotificationPreferences = async (companyId, preferences) => {
  try {
    const response = await apiRequest(`/api/push/notification-preferences/${companyId}`, {
      method: 'PUT',
      body: JSON.stringify(preferences)
    });
    const data = await response.json();
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
    const response = await apiRequest('/api/push/test-push', {
      method: 'POST',
      body: JSON.stringify({
        companyId,
        userId
      })
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending test push:', error);
    throw error;
  }
};