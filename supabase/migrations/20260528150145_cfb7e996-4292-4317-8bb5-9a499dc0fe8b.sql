ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS reject_call_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reject_call_message text;