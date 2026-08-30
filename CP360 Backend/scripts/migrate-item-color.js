// Run: node scripts/migrate-item-color.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });
}

const pool = require('../config/database');

async function migrate() {
  console.log('Running item color migration…');

  await pool.query(`ALTER TABLE bidder_library_items ADD COLUMN IF NOT EXISTS color TEXT`);
  console.log('✓ color on bidder_library_items');

  await pool.query(`ALTER TABLE bidder_proposal_items ADD COLUMN IF NOT EXISTS color TEXT`);
  console.log('✓ color on bidder_proposal_items');

  console.log('Migration complete.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
