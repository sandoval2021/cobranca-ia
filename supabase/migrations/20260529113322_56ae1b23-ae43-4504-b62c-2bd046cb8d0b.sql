-- Add extras JSONB column to customer_iptv_credentials so the AppScreen-shaped
-- fields (screen name, status, route, plan_value, app_due_date, etc.) can be
-- persisted in the database alongside the structured columns (server_id, mac,
-- device_key, iptv_username, iptv_password_enc, expires_at, plan_days, notes).
ALTER TABLE public.customer_iptv_credentials
  ADD COLUMN IF NOT EXISTS extras JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_customer_iptv_credentials_company_customer
  ON public.customer_iptv_credentials (company_id, customer_id);