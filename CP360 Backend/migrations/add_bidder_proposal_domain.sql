-- Add custom proposal domain to bidder company settings
-- Run once on Railway PostgreSQL
ALTER TABLE bidder_company_settings
  ADD COLUMN IF NOT EXISTS proposal_domain TEXT;
