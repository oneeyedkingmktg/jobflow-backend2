-- Add PayPal payment integration fields to bidder company settings
ALTER TABLE bidder_company_settings
  ADD COLUMN IF NOT EXISTS paypal_client_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_secret_key TEXT,
  ADD COLUMN IF NOT EXISTS payment_processor VARCHAR(20) DEFAULT 'stripe';
