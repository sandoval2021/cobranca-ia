
CREATE TABLE public.whatsapp_conversation_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  instance_id uuid NOT NULL,
  from_phone text NOT NULL,
  last_messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  classification text,
  needs_human boolean NOT NULL DEFAULT false,
  human_reason text,
  muted_until timestamptz,
  responses_hour_window jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_response_hash text,
  last_response_at timestamptz,
  human_notified_at timestamptz,
  total_messages_in integer NOT NULL DEFAULT 0,
  total_messages_out integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(instance_id, from_phone)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversation_state TO authenticated;
GRANT ALL ON public.whatsapp_conversation_state TO service_role;

ALTER TABLE public.whatsapp_conversation_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view whatsapp_conversation_state"
  ON public.whatsapp_conversation_state FOR SELECT
  TO authenticated USING (has_company_access(company_id));

CREATE POLICY "members update whatsapp_conversation_state"
  ON public.whatsapp_conversation_state FOR UPDATE
  TO authenticated USING (has_company_access(company_id))
  WITH CHECK (has_company_access(company_id));

CREATE INDEX idx_wcs_company_updated ON public.whatsapp_conversation_state (company_id, updated_at DESC);
CREATE INDEX idx_wcs_needs_human ON public.whatsapp_conversation_state (company_id) WHERE needs_human = true;
