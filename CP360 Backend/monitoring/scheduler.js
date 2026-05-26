// Scheduler for key monitoring and holiday refresh
const cron = require('node-cron');
const { checkKeys } = require('./keyMonitor');
const { refreshNextYear } = require('../services/holidayService');

function startMonitoring() {
  const ENABLED = process.env.KEY_MONITOR_ENABLED === 'true';

  if (!ENABLED) {
    console.log('⏭️  Key monitoring disabled');
    return;
  }

  console.log('✅ Key monitoring enabled');

  // Check every hour
  cron.schedule('0 * * * *', async () => {
    console.log('🔍 Running key check...');
    await checkKeys();
  });

  // Daily summary at 11:59 PM
  cron.schedule('59 23 * * *', async () => {
    console.log('📊 Sending daily summary...');
    await checkKeys();
  });

  // Initial check on startup — delay 10s to let the DB pool stabilize after cold start
  setTimeout(() => checkKeys(), 10000);

  // Jan 1 at midnight — fetch next year's holidays so DB always has 2 years ahead
  cron.schedule('0 0 1 1 *', async () => {
    console.log('📅 Refreshing holidays for next year...');
    await refreshNextYear().catch(err => console.error('Holiday refresh failed:', err));
  });
}

module.exports = { startMonitoring };