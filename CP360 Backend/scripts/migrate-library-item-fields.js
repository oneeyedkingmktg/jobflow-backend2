// Run: node scripts/migrate-library-item-fields.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });
}

const pool = require('../config/database');

async function migrate() {
  console.log('Running library item fields migration…');

  await pool.query(`ALTER TABLE bidder_library_items ADD COLUMN IF NOT EXISTS supplier TEXT`);
  console.log('✓ supplier column');

  await pool.query(`ALTER TABLE bidder_library_items ADD COLUMN IF NOT EXISTS kit_price NUMERIC(10,4)`);
  console.log('✓ kit_price column');

  await pool.query(`ALTER TABLE bidder_library_items ADD COLUMN IF NOT EXISTS sqft_per_kit NUMERIC(10,4)`);
  console.log('✓ sqft_per_kit column');

  console.log('Migration complete.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
