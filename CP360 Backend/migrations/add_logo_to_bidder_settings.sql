-- Add logo_url to bidder_company_settings
ALTER TABLE bidder_company_settings
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Insert Professional design template (id will auto-assign)
INSERT INTO bidder_proposal_designs (name, description, template_content, is_active)
VALUES (
  'Professional',
  'Clean professional design — dark charcoal header, orange accent, itemized table, dark footer',
  '{"theme":"professional-v1","accent_color":"#f97316","header_color":"#1c2333","tagline":"PREMIUM COATING. EXCEPTIONAL RESULTS.","footer_text":"Thank you for the opportunity to earn your business!"}',
  true
)
ON CONFLICT DO NOTHING;
