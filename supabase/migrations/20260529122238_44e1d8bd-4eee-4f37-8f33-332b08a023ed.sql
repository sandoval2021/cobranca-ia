CREATE TABLE IF NOT EXISTS public.service_message_dispatch_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  service_plan_id uuid NOT NULL,
  service_plan_message_id uuid NOT NULL,
  cycle_key text NOT NULL,
  dispatch_type text NOT NULL DEFAULT 'manual' CHECK (dispatch_type IN ('manual','auto')),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('planned','sent','failed','skipped')),
  message_body text,
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_smdl_customer_msg_cycle
  ON public.service_message_dispatch_log (customer_id, service_plan_message_id, cycle_key);

CREATE INDEX IF NOT EXISTS ix_smdl_company_created
  ON public.service_message_dispatch_log (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_smdl_plan_message
  ON public.service_message_dispatch_log (service_plan_id, service_plan_message_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_message_dispatch_log TO authenticated;
GRANT ALL ON public.service_message_dispatch_log TO service_role;

ALTER TABLE public.service_message_dispatch_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view service_message_dispatch_log"
  ON public.service_message_dispatch_log FOR SELECT TO authenticated
  USING (public.has_company_access(company_id));

CREATE POLICY "members insert service_message_dispatch_log"
  ON public.service_message_dispatch_log FOR INSERT TO authenticated
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "members update service_message_dispatch_log"
  ON public.service_message_dispatch_log FOR UPDATE TO authenticated
  USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "members delete service_message_dispatch_log"
  ON public.service_message_dispatch_log FOR DELETE TO authenticated
  USING (public.has_company_access(company_id));

CREATE TRIGGER trg_smdl_touch_updated_at
  BEFORE UPDATE ON public.service_message_dispatch_log
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();