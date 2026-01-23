import { Capacitor } from '@capacitor/core';

/**
 * Detect if app is running as native mobile app
 */
export const isNativeApp = () => {
  return Capacitor.isNativePlatform();
};

/**
 * Get current platform
 */
export const getPlatform = () => {
  return Capacitor.getPlatform(); // 'ios', 'android', or 'web'
};

/**
 * Check if iOS
 */
export const isIOS = () => {
  return Capacitor.getPlatform() === 'ios';
};

/**
 * Check if Android
 */
export const isAndroid = () => {
  return Capacitor.getPlatform() === 'android';
};

/**
 * Check if web browser
 */
export const isWeb = () => {
  return Capacitor.getPlatform() === 'web';
};

/**
 * Should show desktop-style UI (for Apple approval strategy)
 */
export const shouldShowDesktopUI = () => {
  return isNativeApp();
};

/**
 * Should show notification settings (only in native app)
 */
export const canUseNotifications = () => {
  return isNativeApp();
};

/**
 * Is demo account
 */
export const isDemoAccount = (user) => {
  return user?.company_id === 999 || user?.companyId === 999;
};