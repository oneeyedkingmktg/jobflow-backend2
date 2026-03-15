/**
 * Migration: Create device_tokens and notification_preferences tables
 * Run once: node scripts/migrate-push-notifications.js
 */

require('dotenv').config({ path: '.env.local' });
const { pool } = require('../config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running push notification migration...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS device_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        device_token TEXT NOT NULL UNIQUE,
        platform VARCHAR(10),
        created_at TIMESTAMP DEFAULT NOW(),
        last_used TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ device_tokens table ready');

    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        notify_new_lead BOOLEAN DEFAULT true,
        notify_new_estimator_lead BOOLEAN DEFAULT true,
        notify_appointment_reminder BOOLEAN DEFAULT true,
        notify_job_sold BOOLEAN DEFAULT true,
        notify_install_reminder BOOLEAN DEFAULT true,
        notify_new_message BOOLEAN DEFAULT true,
        notify_missed_call BOOLEAN DEFAULT true,
        notify_voicemail_left BOOLEAN DEFAULT true,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ notification_preferences table ready');

    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
