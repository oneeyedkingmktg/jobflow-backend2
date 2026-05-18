-- Migration: Add utm_content column to leads table
-- Run once on Railway PostgreSQL

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS utm_content TEXT;
