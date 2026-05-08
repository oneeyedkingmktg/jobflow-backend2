-- Add is_note column to bidder_custom_items for note/comment line items
ALTER TABLE bidder_custom_items ADD COLUMN IF NOT EXISTS is_note BOOLEAN DEFAULT false;

-- Allow fractional sort_order values so "insert above" can place items between existing ones
ALTER TABLE bidder_custom_items ALTER COLUMN sort_order TYPE FLOAT8;
ALTER TABLE bidder_proposal_items ALTER COLUMN sort_order TYPE FLOAT8;
