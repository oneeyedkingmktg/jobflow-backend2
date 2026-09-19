-- Many-to-many: library items can belong to multiple global product categories
CREATE TABLE IF NOT EXISTS bidder_library_item_categories (
  library_item_id    INTEGER NOT NULL REFERENCES bidder_library_items(id) ON DELETE CASCADE,
  global_category_id INTEGER NOT NULL REFERENCES global_product_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (library_item_id, global_category_id)
);
CREATE INDEX IF NOT EXISTS idx_blic_item ON bidder_library_item_categories(library_item_id);

-- Migrate existing single-category assignments into the junction table
INSERT INTO bidder_library_item_categories (library_item_id, global_category_id)
SELECT id, global_category_id
FROM bidder_library_items
WHERE global_category_id IS NOT NULL
ON CONFLICT DO NOTHING;
