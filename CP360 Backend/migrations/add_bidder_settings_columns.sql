-- Add missing columns to bidder_company_settings
-- Run once on Railway PostgreSQL
-- Safe to run multiple times (IF NOT EXISTS)
ALTER TABLE bidder_company_settings ADD COLUMN IF NOT EXISTS email_from_name TEXT;
ALTER TABLE bidder_company_settings ADD COLUMN IF NOT EXISTS email_from_email TEXT;
ALTER TABLE bidder_company_settings ADD COLUMN IF NOT EXISTS proposal_top_text TEXT;
ALTER TABLE bidder_company_settings ADD COLUMN IF NOT EXISTS invoice_top_text TEXT;
ALTER TABLE bidder_company_settings ADD COLUMN IF NOT EXISTS proposal_domain TEXT;
