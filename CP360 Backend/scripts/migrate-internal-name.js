// Run: node scripts/migrate-internal-name.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });
}

const pool = require('../config/database');

async function migrate() {
  console.log('Adding internal_name and internal_description columns…');

  await pool.query(`ALTER TABLE global_supplier_products ADD COLUMN IF NOT EXISTS internal_name TEXT`);
  console.log('✓ global_supplier_products.internal_name');

  await pool.query(`ALTER TABLE global_supplier_products ADD COLUMN IF NOT EXISTS internal_description TEXT`);
  console.log('✓ global_supplier_products.internal_description');

  await pool.query(`ALTER TABLE bidder_library_items ADD COLUMN IF NOT EXISTS internal_name TEXT`);
  console.log('✓ bidder_library_items.internal_name');

  await pool.query(`ALTER TABLE bidder_library_items ADD COLUMN IF NOT EXISTS internal_description TEXT`);
  console.log('✓ bidder_library_items.internal_description');

  console.log('Migration complete.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
