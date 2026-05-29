-- Fase 2A: planos do dono, mensagens por plano e vínculo cliente↔plano

CREATE TABLE public.service_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  nome text NOT NULL,
  preco_cents integer NOT NULL DEFAULT 0,
  telas integer NOT NULL DEFAULT 1,
  meses integer NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_service_plans_company ON public.service_plans(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_plans TO authenticated;
GRANT ALL ON public.service_plans TO service_role;

ALTER TABLE public.service_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view service_plans" ON public.service_plans
  FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY "members insert service_plans" ON public.service_plans
  FOR INSERT TO authenticated WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members update service_plans" ON public.service_plans
  FOR UPDATE TO authenticated USING (public.has_company_access(company_id)) WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members delete service_plans" ON public.service_plans
  FOR DELETE TO authenticated USING (public.has_company_access(company_id));

CREATE TRIGGER trg_service_plans_updated_at
  BEFORE UPDATE ON public.service_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


CREATE TABLE public.service_plan_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  service_plan_id uuid NOT NULL REFERENCES public.service_plans(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('cobranca','acompanhamento')),
  offset_days integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  template text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_service_plan_messages_plan ON public.service_plan_messages(service_plan_id);
CREATE INDEX idx_service_plan_messages_company ON public.service_plan_messages(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_plan_messages TO authenticated;
GRANT ALL ON public.service_plan_messages TO service_role;

ALTER TABLE public.service_plan_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view service_plan_messages" ON public.service_plan_messages
  FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY "members insert service_plan_messages" ON public.service_plan_messages
  FOR INSERT TO authenticated WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members update service_plan_messages" ON public.service_plan_messages
  FOR UPDATE TO authenticated USING (public.has_company_access(company_id)) WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members delete service_plan_messages" ON public.service_plan_messages
  FOR DELETE TO authenticated USING (public.has_company_access(company_id));

CREATE TRIGGER trg_service_plan_messages_updated_at
  BEFORE UPDATE ON public.service_plan_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


CREATE TABLE public.customer_service_plan (
  customer_id uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  service_plan_id uuid NOT NULL REFERENCES public.service_plans(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_service_plan_company ON public.customer_service_plan(company_id);
CREATE INDEX idx_customer_service_plan_plan ON public.customer_service_plan(service_plan_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_service_plan TO authenticated;
GRANT ALL ON public.customer_service_plan TO service_role;

ALTER TABLE public.customer_service_plan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view customer_service_plan" ON public.customer_service_plan
  FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY "members insert customer_service_plan" ON public.customer_service_plan
  FOR INSERT TO authenticated WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members update customer_service_plan" ON public.customer_service_plan
  FOR UPDATE TO authenticated USING (public.has_company_access(company_id)) WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members delete customer_service_plan" ON public.customer_service_plan
  FOR DELETE TO authenticated USING (public.has_company_access(company_id));

CREATE TRIGGER trg_customer_service_plan_updated_at
  BEFORE UPDATE ON public.customer_service_plan
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();