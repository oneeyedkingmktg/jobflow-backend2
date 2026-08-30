// Run: node scripts/migrate-library-charge-only.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });
}

const pool = require('../config/database');

async function migrate() {
  console.log('Running charge-only migration…');

  await pool.query(`
    ALTER TABLE bidder_library_items ADD COLUMN IF NOT EXISTS is_charge_only BOOLEAN DEFAULT false
  `);
  console.log('✓ is_charge_only column on bidder_library_items');

  console.log('Migration complete.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
