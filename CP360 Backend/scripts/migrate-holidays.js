// Run once on Render shell: node scripts/migrate-holidays.js
require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local' });

const pool = require('../config/database');

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS holidays (
      id   SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      name TEXT NOT NULL,
      UNIQUE(date)
    )
  `);
  console.log('✅ holidays table ready');
  process.exit(0);
}

run().catch((err) => { console.error('Migration failed:', err); process.exit(1); });
