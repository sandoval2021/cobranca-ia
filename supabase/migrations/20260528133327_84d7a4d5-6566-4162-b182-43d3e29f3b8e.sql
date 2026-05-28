ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS pairing_code TEXT,
  ADD COLUMN IF NOT EXISTS pairing_code_expires_at TIMESTAMPTZ;