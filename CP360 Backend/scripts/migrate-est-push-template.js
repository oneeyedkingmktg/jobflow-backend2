// Migration: Add estimator push notification template columns to companies
// Run: node "CP360 Backend/scripts/migrate-est-push-template.js"

require('dotenv').config({ path: '.env.local' });
const { pool } = require('../config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE companies
        ADD COLUMN IF NOT EXISTS est_push_title VARCHAR(255) DEFAULT 'New Estimator Lead',
        ADD COLUMN IF NOT EXISTS est_push_body TEXT DEFAULT '{{name}} just submitted an estimator request for a {{project}} project. Click to open lead.'
    `);
    console.log('✅ Migration complete: est_push_title and est_push_body added to companies');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    client.release();
    process.exit();
  }
}

migrate();
