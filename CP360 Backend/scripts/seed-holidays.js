// One-time script: clears and re-seeds US federal holidays for current year and next year.
// Run on Render shell: node scripts/seed-holidays.js
require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local' });

const pool = require('../config/database');
const { seedInitial } = require('../services/holidayService');

async function run() {
  const year = new Date().getFullYear();
  // Wipe existing rows for both years so removed holidays don't survive
  await pool.query(`DELETE FROM holidays WHERE EXTRACT(year FROM date) IN ($1, $2)`, [year, year + 1]);
  await seedInitial();
  console.log('Seed complete.');
  process.exit(0);
}

run().catch((err) => { console.error('Seed failed:', err); process.exit(1); });
