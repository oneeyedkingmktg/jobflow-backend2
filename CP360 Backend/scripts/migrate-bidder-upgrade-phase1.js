// Run: node scripts/migrate-bidder-upgrade-phase1.js
// Phase 1 of the bidder upgrade: adds supplier info fields, company supplier discount,
// global product categories, new SKU fields (purchase_unit, coverage, URLs),
// company product favorites, and custom-item support in bid_material_overrides.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });
}

const pool = require('../config/database');

async function migrate() {
  console.log('Running bidder upgrade Phase 1 migration…\n');

  // ── 1. New contact/info fields on global_suppliers ────────────────────────
  await pool.query(`ALTER TABLE global_suppliers ADD COLUMN IF NOT EXISTS phone TEXT`);
  await pool.query(`ALTER TABLE global_suppliers ADD COLUMN IF NOT EXISTS website TEXT`);
  await pool.query(`ALTER TABLE global_suppliers ADD COLUMN IF NOT EXISTS contact_name TEXT`);
  await pool.query(`ALTER TABLE global_suppliers ADD COLUMN IF NOT EXISTS lead_time TEXT`);
  await pool.query(`ALTER TABLE global_suppliers ADD COLUMN IF NOT EXISTS order_email TEXT`);
  console.log('✓ global_suppliers: phone, website, contact_name, lead_time, order_email');

  // ── 2. Company-specific supplier discount + notes ─────────────────────────
  await pool.query(`ALTER TABLE company_supplier_access ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE company_supplier_access ADD COLUMN IF NOT EXISTS notes TEXT`);
  console.log('✓ company_supplier_access: discount_percent, notes');

  // ── 3. Global product categories ──────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS global_product_categories (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active  BOOLEAN NOT NULL DEFAULT true
    )
  `);
  // Seed the required Uncategorized fallback row (idempotent)
  await pool.query(`
    INSERT INTO global_product_categories (name, sort_order)
    VALUES ('Uncategorized', 9999)
    ON CONFLICT (name) DO NOTHING
  `);
  console.log('✓ global_product_categories table + Uncategorized seed');

  // ── 4. New fields on global_supplier_products ─────────────────────────────
  await pool.query(`ALTER TABLE global_supplier_products ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES global_product_categories(id)`);
  await pool.query(`ALTER TABLE global_supplier_products ADD COLUMN IF NOT EXISTS purchase_unit TEXT NOT NULL DEFAULT 'Kit'`);
  await pool.query(`ALTER TABLE global_supplier_products ADD COLUMN IF NOT EXISTS coverage_per_unit NUMERIC(10,4)`);
  await pool.query(`ALTER TABLE global_supplier_products ADD COLUMN IF NOT EXISTS coverage_type TEXT`);
  await pool.query(`ALTER TABLE global_supplier_products ADD COLUMN IF NOT EXISTS available_colors TEXT`);
  await pool.query(`ALTER TABLE global_supplier_products ADD COLUMN IF NOT EXISTS product_page_url TEXT`);
  await pool.query(`ALTER TABLE global_supplier_products ADD COLUMN IF NOT EXISTS spec_sheet_url TEXT`);
  console.log('✓ global_supplier_products: category_id, purchase_unit, coverage_per_unit, coverage_type, available_colors, product_page_url, spec_sheet_url');

  // Assign existing global products to Uncategorized
  const catAssign = await pool.query(`
    UPDATE global_supplier_products
    SET category_id = (SELECT id FROM global_product_categories WHERE name = 'Uncategorized')
    WHERE category_id IS NULL
  `);
  console.log(`✓ global_supplier_products: ${catAssign.rowCount} existing products assigned to Uncategorized`);

  // Seed coverage_per_unit from sqft_per_kit for existing products
  const coverageSeed = await pool.query(`
    UPDATE global_supplier_products
    SET coverage_per_unit = sqft_per_kit
    WHERE sqft_per_kit IS NOT NULL AND sqft_per_kit > 0 AND coverage_per_unit IS NULL
  `);
  console.log(`✓ global_supplier_products: ${coverageSeed.rowCount} rows seeded coverage_per_unit from sqft_per_kit`);

  // ── 5. Mirror new fields on bidder_library_items ──────────────────────────
  await pool.query(`ALTER TABLE bidder_library_items ADD COLUMN IF NOT EXISTS purchase_unit TEXT NOT NULL DEFAULT 'Kit'`);
  await pool.query(`ALTER TABLE bidder_library_items ADD COLUMN IF NOT EXISTS coverage_per_unit NUMERIC(10,4)`);
  await pool.query(`ALTER TABLE bidder_library_items ADD COLUMN IF NOT EXISTS coverage_type TEXT`);
  await pool.query(`ALTER TABLE bidder_library_items ADD COLUMN IF NOT EXISTS available_colors TEXT`);
  await pool.query(`ALTER TABLE bidder_library_items ADD COLUMN IF NOT EXISTS product_page_url TEXT`);
  await pool.query(`ALTER TABLE bidder_library_items ADD COLUMN IF NOT EXISTS spec_sheet_url TEXT`);
  await pool.query(`ALTER TABLE bidder_library_items ADD COLUMN IF NOT EXISTS global_category_id INTEGER REFERENCES global_product_categories(id)`);
  console.log('✓ bidder_library_items: purchase_unit, coverage_per_unit, coverage_type, available_colors, product_page_url, spec_sheet_url, global_category_id');

  // Backfill new fields from global products for all linked library items
  const libBackfill = await pool.query(`
    UPDATE bidder_library_items li
    SET
      purchase_unit     = gsp.purchase_unit,
      coverage_per_unit = gsp.coverage_per_unit,
      coverage_type     = gsp.coverage_type,
      global_category_id = gsp.category_id
    FROM global_supplier_products gsp
    WHERE li.source_supplier_product_id = gsp.id
  `);
  console.log(`✓ bidder_library_items: ${libBackfill.rowCount} linked items backfilled from global products`);

  // Seed coverage_per_unit from sqft_per_kit for non-linked library items
  const libCoverageSeed = await pool.query(`
    UPDATE bidder_library_items
    SET coverage_per_unit = sqft_per_kit
    WHERE sqft_per_kit IS NOT NULL AND sqft_per_kit > 0 AND coverage_per_unit IS NULL
  `);
  console.log(`✓ bidder_library_items: ${libCoverageSeed.rowCount} non-linked items seeded coverage_per_unit from sqft_per_kit`);

  // ── 6. Company product favorites ──────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS company_product_favorites (
      id                        SERIAL PRIMARY KEY,
      company_id                INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      global_supplier_product_id INTEGER NOT NULL REFERENCES global_supplier_products(id) ON DELETE CASCADE,
      created_at                TIMESTAMP DEFAULT NOW(),
      UNIQUE(company_id, global_supplier_product_id)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_cpf_company_id
    ON company_product_favorites(company_id)
  `);
  console.log('✓ company_product_favorites table + index');

  // ── 7. Extend bid_material_overrides for custom items ─────────────────────
  // library_item_id must become nullable so custom-item rows can omit it.
  await pool.query(`
    ALTER TABLE bid_material_overrides
      ALTER COLUMN library_item_id DROP NOT NULL
  `);
  console.log('✓ bid_material_overrides: library_item_id is now nullable');

  // Add custom_item_id FK
  await pool.query(`
    ALTER TABLE bid_material_overrides
      ADD COLUMN IF NOT EXISTS custom_item_id INTEGER REFERENCES bidder_custom_items(id) ON DELETE CASCADE
  `);
  console.log('✓ bid_material_overrides: custom_item_id column added');

  // Replace the old compound unique constraint with two partial unique indexes.
  // The old constraint name follows PostgreSQL auto-naming: {table}_{col1}_{col2}_key
  await pool.query(`
    ALTER TABLE bid_material_overrides
      DROP CONSTRAINT IF EXISTS bid_material_overrides_proposal_id_library_item_id_key
  `);

  // Partial unique index for library item overrides
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bmo_proposal_library
    ON bid_material_overrides(proposal_id, library_item_id)
    WHERE library_item_id IS NOT NULL
  `);

  // Partial unique index for custom item overrides
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bmo_proposal_custom
    ON bid_material_overrides(proposal_id, custom_item_id)
    WHERE custom_item_id IS NOT NULL
  `);
  console.log('✓ bid_material_overrides: partial unique indexes for library and custom item overrides');

  console.log('\nPhase 1 migration complete.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
