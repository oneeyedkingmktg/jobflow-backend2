// Scheduler for key monitoring
const cron = require('node-cron');
const { checkKeys } = require('./keyMonitor');

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
  
  // Initial check on startup
  checkKeys();
}

module.exports = { startMonitoring };