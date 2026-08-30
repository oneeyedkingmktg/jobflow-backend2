-- Migration: Global supplier catalog + per-supplier product lists (master-managed)

CREATE TABLE IF NOT EXISTS global_suppliers (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  notes       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS global_supplier_products (
  id                  SERIAL PRIMARY KEY,
  supplier_id         INTEGER NOT NULL REFERENCES global_suppliers(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  default_unit_price  NUMERIC(10,2) NOT NULL DEFAULT 0,
  default_unit_label  TEXT NOT NULL DEFAULT 'per sqft',
  color               TEXT,
  kit_price           NUMERIC(10,2),
  sqft_per_kit        NUMERIC(10,2),
  is_charge_only      BOOLEAN NOT NULL DEFAULT false,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);
