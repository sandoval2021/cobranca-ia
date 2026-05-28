CREATE TABLE IF NOT EXISTS public.whatsapp_automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  event_type text NOT NULL,
  status text NOT NULL,
  provider_event text,
  provider_instance text,
  from_phone text,
  message_preview text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.whatsapp_automation_logs TO authenticated;
GRANT ALL ON public.whatsapp_automation_logs TO service_role;

ALTER TABLE public.whatsapp_automation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members view whatsapp automation logs" ON public.whatsapp_automation_logs;
CREATE POLICY "members view whatsapp automation logs"
  ON public.whatsapp_automation_logs
  FOR SELECT TO authenticated
  USING (public.has_company_access(company_id));

CREATE INDEX IF NOT EXISTS whatsapp_automation_logs_instance_created_idx
  ON public.whatsapp_automation_logs (instance_id, created_at DESC);

CREATE INDEX IF NOT EXISTS whatsapp_automation_logs_company_created_idx
  ON public.whatsapp_automation_logs (company_id, created_at DESC);