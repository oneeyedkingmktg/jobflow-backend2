-- Migration: Out of Area / Large Job feature
-- Run once on Railway PostgreSQL

ALTER TABLE estimator_configs
  ADD COLUMN IF NOT EXISTS out_of_area_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS out_of_area_large_job_threshold NUMERIC,
  ADD COLUMN IF NOT EXISTS out_of_area_sorry_message TEXT,
  ADD COLUMN IF NOT EXISTS out_of_area_large_job_message TEXT,
  ADD COLUMN IF NOT EXISTS out_of_area_price_disclaimer TEXT;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS out_of_area_large_job BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS out_of_area_logs (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW(),
  company_id INTEGER REFERENCES companies(id),
  homeowner_name TEXT,
  zip_code TEXT,
  estimated_value NUMERIC,
  status TEXT
);
