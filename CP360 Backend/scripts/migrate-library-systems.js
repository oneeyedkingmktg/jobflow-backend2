// Run: node scripts/migrate-library-systems.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });
}

const pool = require('../config/database');

async function migrate() {
  console.log('Running library systems migration…');

  await pool.query(`
    ALTER TABLE bidder_library_items ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false
  `);
  console.log('✓ is_system column on bidder_library_items');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bidder_library_system_components (
      id                SERIAL PRIMARY KEY,
      system_item_id    INTEGER NOT NULL REFERENCES bidder_library_items(id) ON DELETE CASCADE,
      component_item_id INTEGER NOT NULL REFERENCES bidder_library_items(id) ON DELETE CASCADE,
      sort_order        INTEGER DEFAULT 0
    )
  `);
  console.log('✓ bidder_library_system_components table');

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_blsc_system_item_id ON bidder_library_system_components(system_item_id)
  `);
  console.log('✓ index on system_item_id');

  console.log('Migration complete.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
