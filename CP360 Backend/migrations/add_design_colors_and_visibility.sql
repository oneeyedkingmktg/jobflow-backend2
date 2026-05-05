ALTER TABLE bidder_proposal_designs
  ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7) DEFAULT '#1c2333',
  ADD COLUMN IF NOT EXISTS accent_color VARCHAR(7) DEFAULT '#f97316',
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS private_company_id INTEGER REFERENCES companies(id);

-- Migrate blue-gold designs to hex colors
UPDATE bidder_proposal_designs
  SET primary_color = '#1E73BE', accent_color = '#FFC133'
  WHERE color_scheme = 'blue-gold';
