-- Many-to-many: global supplier products can belong to multiple categories
CREATE TABLE IF NOT EXISTS global_supplier_product_categories (
  global_supplier_product_id INTEGER NOT NULL REFERENCES global_supplier_products(id) ON DELETE CASCADE,
  global_category_id         INTEGER NOT NULL REFERENCES global_product_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (global_supplier_product_id, global_category_id)
);
CREATE INDEX IF NOT EXISTS idx_gspc_product ON global_supplier_product_categories(global_supplier_product_id);

-- Migrate existing single-category assignments into the junction table
INSERT INTO global_supplier_product_categories (global_supplier_product_id, global_category_id)
SELECT id, category_id
FROM global_supplier_products
WHERE category_id IS NOT NULL
ON CONFLICT DO NOTHING;
