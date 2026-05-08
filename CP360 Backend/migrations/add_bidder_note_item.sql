-- Add is_note column to bidder_custom_items for note/comment line items
ALTER TABLE bidder_custom_items ADD COLUMN IF NOT EXISTS is_note BOOLEAN DEFAULT false;
