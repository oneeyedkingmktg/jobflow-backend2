-- Add Stripe payment integration fields to bidder company settings
ALTER TABLE bidder_company_settings
  ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT,
  ADD COLUMN IF NOT EXISTS stripe_secret_key TEXT;
