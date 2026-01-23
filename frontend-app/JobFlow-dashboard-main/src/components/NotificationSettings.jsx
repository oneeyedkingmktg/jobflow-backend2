import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { useCompany } from '../CompanyContext';
import { 
  getNotificationPreferences, 
  updateNotificationPreferences,
  sendTestPush 
} from '../services/pushNotificationService';
import { canUseNotifications, isDemoAccount } from '../utils/platform';

export default function NotificationSettings() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [preferences, setPreferences] = useState({
    notifyNewLead: true,
    notifyAppointmentReminder: true,
    notifyJobSold: true,
    notifyJobComplete: false,
    notifyPaymentReceived: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [message, setMessage] = useState('');

  const companyId = currentCompany?.id || user?.company_id || user?.companyId;

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, [companyId]);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const prefs = await getNotificationPreferences(companyId);
      
      setPreferences({
        notifyNewLead: prefs.notify_new_lead,
        notifyAppointmentReminder: prefs.notify_appointment_reminder,
        notifyJobSold: prefs.notify_job_sold,
        notifyJobComplete: prefs.notify_job_complete,
        notifyPaymentReceived: prefs.notify_payment_received,
      });
    } catch (error) {
      console.error('Error loading preferences:', error);
      setMessage('Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key) => {
    const newPreferences = {
      ...preferences,
      [key]: !preferences[key],
    };
    
    setPreferences(newPreferences);
    await savePreferences(newPreferences);
  };

  const savePreferences = async (prefs) => {
    try {
      setSaving(true);
      await updateNotificationPreferences(companyId, prefs);
      setMessage('✅ Settings saved');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error saving preferences:', error);
      setMessage('❌ Failed to save settings');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleTestPush = async () => {
    try {
      setTestingPush(true);
      await sendTestPush(companyId, user.id);
      setMessage('🎉 Test notification sent! Check your device.');
      setTimeout(() => setMessage(''), 5000);
    } catch (error) {
      console.error('Error sending test push:', error);
      setMessage('❌ Failed to send test notification');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setTestingPush(false);
    }
  };

  // Only show in native app
  if (!canUseNotifications()) {
    return (
      <div className="p-6 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="text-lg font-bold text-blue-900 mb-2">
          📱 Install the Mobile App
        </h3>
        <p className="text-blue-800">
          Push notifications are only available in the CoatingPro360 mobile app. 
          Install the app to receive instant alerts for new leads, appointments, and more!
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
        <p className="mt-2 text-gray-600">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Push Notification Settings</h2>
      
      <p className="text-gray-600 mb-6">
        Choose which notifications you want to receive on this device.
      </p>

      {message && (
        <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg">
          {message}
        </div>
      )}

      <div className="space-y-4">
        {/* New Lead */}
        <label className="flex items-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.notifyNewLead}
            onChange={() => handleToggle('notifyNewLead')}
            className="w-5 h-5 text-blue-600 rounded"
            disabled={saving}
          />
          <div className="ml-3">
            <div className="font-semibold">New Lead</div>
            <div className="text-sm text-gray-600">
              Get notified when a new lead is added to your pipeline
            </div>
          </div>
        </label>

        {/* Appointment Reminder */}
        <label className="flex items-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.notifyAppointmentReminder}
            onChange={() => handleToggle('notifyAppointmentReminder')}
            className="w-5 h-5 text-blue-600 rounded"
            disabled={saving}
          />
          <div className="ml-3">
            <div className="font-semibold">Appointment Reminder</div>
            <div className="text-sm text-gray-600">
              Get notified 2 hours before scheduled appointments
            </div>
          </div>
        </label>

        {/* Job Sold */}
        <label className="flex items-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.notifyJobSold}
            onChange={() => handleToggle('notifyJobSold')}
            className="w-5 h-5 text-blue-600 rounded"
            disabled={saving}
          />
          <div className="ml-3">
            <div className="font-semibold">Job Sold</div>
            <div className="text-sm text-gray-600">
              Get notified when a job is marked as sold/won
            </div>
          </div>
        </label>

        {/* Job Complete */}
        <label className="flex items-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.notifyJobComplete}
            onChange={() => handleToggle('notifyJobComplete')}
            className="w-5 h-5 text-blue-600 rounded"
            disabled={saving}
          />
          <div className="ml-3">
            <div className="font-semibold">Job Complete</div>
            <div className="text-sm text-gray-600">
              Get notified when installation is marked complete
            </div>
          </div>
        </label>

        {/* Payment Received */}
        <label className="flex items-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.notifyPaymentReceived}
            onChange={() => handleToggle('notifyPaymentReceived')}
            className="w-5 h-5 text-blue-600 rounded"
            disabled={saving}
          />
          <div className="ml-3">
            <div className="font-semibold">Payment Received</div>
            <div className="text-sm text-gray-600">
              Get notified when payment is logged
            </div>
          </div>
        </label>
      </div>

      {/* Test Push Button */}
      <div className="mt-6 pt-6 border-t">
        <button
          onClick={handleTestPush}
          disabled={testingPush}
          className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testingPush ? 'Sending...' : '🔔 Send Test Notification'}
        </button>
        <p className="mt-2 text-sm text-gray-500 text-center">
          Send a test notification to verify push notifications are working
        </p>
      </div>
    </div>
  );
}