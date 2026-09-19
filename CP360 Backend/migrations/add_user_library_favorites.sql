-- Per-user favorites for all library items (replaces per-company global-supplier-only favorites)
CREATE TABLE IF NOT EXISTS user_library_favorites (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  library_item_id  INTEGER NOT NULL REFERENCES bidder_library_items(id) ON DELETE CASCADE,
  created_at       TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, library_item_id)
);
CREATE INDEX IF NOT EXISTS idx_user_library_favorites_user ON user_library_favorites(user_id);
