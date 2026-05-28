ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS ai_reply_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_system_prompt text;

CREATE TABLE IF NOT EXISTS public.whatsapp_inbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  provider_msg_id text NOT NULL,
  from_phone text NOT NULL,
  body text,
  reply_text text,
  reply_status text NOT NULL DEFAULT 'pending',
  reply_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  replied_at timestamptz,
  CONSTRAINT whatsapp_inbound_messages_unique UNIQUE (instance_id, provider_msg_id)
);

CREATE INDEX IF NOT EXISTS whatsapp_inbound_messages_company_idx
  ON public.whatsapp_inbound_messages (company_id, created_at DESC);

GRANT SELECT ON public.whatsapp_inbound_messages TO authenticated;
GRANT ALL ON public.whatsapp_inbound_messages TO service_role;

ALTER TABLE public.whatsapp_inbound_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members view company inbound" ON public.whatsapp_inbound_messages;
CREATE POLICY "members view company inbound"
  ON public.whatsapp_inbound_messages
  FOR SELECT TO authenticated
  USING (has_company_access(company_id));