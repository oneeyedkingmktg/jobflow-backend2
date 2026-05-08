-- Add is_note column to bidder_custom_items for note/comment line items
ALTER TABLE bidder_custom_items ADD COLUMN IF NOT EXISTS is_note BOOLEAN DEFAULT false;

-- Add show_price and show_quantity to proposal items and custom items (affects proposal display)
ALTER TABLE bidder_proposal_items ADD COLUMN IF NOT EXISTS show_price BOOLEAN DEFAULT true;
ALTER TABLE bidder_proposal_items ADD COLUMN IF NOT EXISTS show_quantity BOOLEAN DEFAULT true;
ALTER TABLE bidder_custom_items ADD COLUMN IF NOT EXISTS show_price BOOLEAN DEFAULT true;
ALTER TABLE bidder_custom_items ADD COLUMN IF NOT EXISTS show_quantity BOOLEAN DEFAULT true;
