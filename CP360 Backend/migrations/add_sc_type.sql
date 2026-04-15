-- Migration: Add sc_type to service_calls
-- 'service_call' (default) → GHL SC calendar
-- 'follow_up_install'      → GHL Install calendar
ALTER TABLE service_calls
  ADD COLUMN IF NOT EXISTS sc_type VARCHAR(50) DEFAULT 'service_call';
