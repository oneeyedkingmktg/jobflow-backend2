-- Add company-level color overrides to bidder_company_settings.
-- These take priority over the selected proposal design's colors.
ALTER TABLE bidder_company_settings
  ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS accent_color  VARCHAR(7) DEFAULT NULL;
