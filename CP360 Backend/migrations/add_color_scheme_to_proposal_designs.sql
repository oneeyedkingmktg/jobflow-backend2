ALTER TABLE bidder_proposal_designs
  ADD COLUMN IF NOT EXISTS color_scheme VARCHAR(50) DEFAULT 'charcoal-orange';
