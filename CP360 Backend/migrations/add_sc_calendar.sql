-- Migration: Add Service Call Calendar fields to companies and service_calls tables
-- Run once against Railway PostgreSQL

-- Add SC calendar fields to companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS ghl_sc_calendar TEXT,
  ADD COLUMN IF NOT EXISTS ghl_sc_assigned_user TEXT;

-- Add end date to service_calls for multi-day service calls
ALTER TABLE service_calls
  ADD COLUMN IF NOT EXISTS scheduled_end_date DATE;
