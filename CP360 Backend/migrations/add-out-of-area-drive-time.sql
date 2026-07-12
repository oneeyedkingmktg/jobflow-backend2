-- Migration: Out-of-area lead flag + drive time cache on leads table
-- Run once on Railway PostgreSQL

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS out_of_area BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS drive_time_minutes INTEGER;
