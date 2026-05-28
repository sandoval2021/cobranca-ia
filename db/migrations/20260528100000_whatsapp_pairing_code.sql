-- Add pairing code fields to whatsapp_instances so the user can connect
-- via 8-digit pairing code instead of scanning the QR.

ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS pairing_code TEXT,
  ADD COLUMN IF NOT EXISTS pairing_code_expires_at TIMESTAMPTZ;
