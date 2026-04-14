-- Migration: Add scheduled_end_time to service_calls
-- Run once against Railway PostgreSQL

ALTER TABLE service_calls
  ADD COLUMN IF NOT EXISTS scheduled_end_time TIME;
