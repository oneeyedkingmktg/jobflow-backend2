ALTER TABLE bidder_proposals ADD COLUMN IF NOT EXISTS site_conditions JSONB DEFAULT '{}'::jsonb;
