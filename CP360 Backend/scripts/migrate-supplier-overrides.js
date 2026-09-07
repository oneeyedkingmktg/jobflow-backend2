// Run: node "CP360 Backend/scripts/migrate-supplier-overrides.js"
// Adds cost_override and coverage_override to bidder_library_items.
// Backfills overrides for linked items whose values differ from the global catalog.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });
}

const pool = require('../config/database');

async function migrate() {
  console.log('Running supplier-overrides migration…');

  await pool.query(`ALTER TABLE bidder_library_items ADD COLUMN IF NOT EXISTS cost_override NUMERIC(10,4)`);
  console.log('✓ cost_override column');

  await pool.query(`ALTER TABLE bidder_library_items ADD COLUMN IF NOT EXISTS coverage_override NUMERIC(10,4)`);
  console.log('✓ coverage_override column');

  // Backfill cost_override for linked items whose kit_price differs from the global value.
  // These items were customized before the override system existed.
  const costResult = await pool.query(`
    UPDATE bidder_library_items li
    SET cost_override = li.kit_price
    FROM global_supplier_products gsp
    WHERE li.source_supplier_product_id = gsp.id
      AND li.kit_price IS NOT NULL
      AND gsp.kit_price IS NOT NULL
      AND li.kit_price <> gsp.kit_price
  `);
  console.log(`✓ cost_override backfill — ${costResult.rowCount} rows`);

  // Backfill coverage_override for linked items whose sqft_per_kit differs from the global value.
  const coverageResult = await pool.query(`
    UPDATE bidder_library_items li
    SET coverage_override = li.sqft_per_kit
    FROM global_supplier_products gsp
    WHERE li.source_supplier_product_id = gsp.id
      AND li.sqft_per_kit IS NOT NULL
      AND gsp.sqft_per_kit IS NOT NULL
      AND li.sqft_per_kit <> gsp.sqft_per_kit
  `);
  console.log(`✓ coverage_override backfill — ${coverageResult.rowCount} rows`);

  console.log('Migration complete.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
