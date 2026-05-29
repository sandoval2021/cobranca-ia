-- ============================================================================
-- FASE 3 — DB-FIRST + REALTIME
-- ============================================================================

-- 1) trial_leads
CREATE TABLE public.trial_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  nome text,
  whatsapp text NOT NULL,
  origem text,
  status text,
  data_contato timestamptz,
  data_inicio timestamptz,
  data_fim timestamptz,
  app text,
  servidor text,
  servidor_adicional text,
  usuario text,
  senha text,
  valor_cents integer,
  horas_teste integer,
  interesse text,
  observacoes text,
  extra jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trial_leads_company_idx ON public.trial_leads(company_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trial_leads TO authenticated;
GRANT ALL ON public.trial_leads TO service_role;
ALTER TABLE public.trial_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trial_leads_company_access" ON public.trial_leads
  FOR ALL TO authenticated
  USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));
CREATE TRIGGER trial_leads_touch BEFORE UPDATE ON public.trial_leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.trial_leads REPLICA IDENTITY FULL;

-- 2) trial_followups
CREATE TABLE public.trial_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  lead_id uuid NOT NULL REFERENCES public.trial_leads(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  data_planejada timestamptz NOT NULL,
  status text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trial_followups_lead_idx ON public.trial_followups(lead_id);
CREATE INDEX trial_followups_company_idx ON public.trial_followups(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trial_followups TO authenticated;
GRANT ALL ON public.trial_followups TO service_role;
ALTER TABLE public.trial_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trial_followups_company_access" ON public.trial_followups
  FOR ALL TO authenticated
  USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));
CREATE TRIGGER trial_followups_touch BEFORE UPDATE ON public.trial_followups
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.trial_followups REPLICA IDENTITY FULL;

-- 3) finance_entries
CREATE TABLE public.finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  tipo text NOT NULL,
  categoria text,
  descricao text,
  valor_cents integer NOT NULL DEFAULT 0,
  data date NOT NULL,
  metodo_pagamento text,
  cliente_id uuid,
  servico_id uuid,
  observacoes text,
  extra jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX finance_entries_company_data_idx ON public.finance_entries(company_id, data DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_entries TO authenticated;
GRANT ALL ON public.finance_entries TO service_role;
ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance_entries_company_access" ON public.finance_entries
  FOR ALL TO authenticated
  USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));
CREATE TRIGGER finance_entries_touch BEFORE UPDATE ON public.finance_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.finance_entries REPLICA IDENTITY FULL;

-- 4) finance_goals
CREATE TABLE public.finance_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  mes text NOT NULL,
  categoria text,
  valor_cents integer NOT NULL DEFAULT 0,
  observacoes text,
  extra jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX finance_goals_company_idx ON public.finance_goals(company_id, mes);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_goals TO authenticated;
GRANT ALL ON public.finance_goals TO service_role;
ALTER TABLE public.finance_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance_goals_company_access" ON public.finance_goals
  FOR ALL TO authenticated
  USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));
CREATE TRIGGER finance_goals_touch BEFORE UPDATE ON public.finance_goals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.finance_goals REPLICA IDENTITY FULL;

-- 5) customer_extras
CREATE TABLE public.customer_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  email text,
  birthday date,
  due_date date,
  extra jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, customer_id)
);
CREATE INDEX customer_extras_company_idx ON public.customer_extras(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_extras TO authenticated;
GRANT ALL ON public.customer_extras TO service_role;
ALTER TABLE public.customer_extras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customer_extras_company_access" ON public.customer_extras
  FOR ALL TO authenticated
  USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));
CREATE TRIGGER customer_extras_touch BEFORE UPDATE ON public.customer_extras
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.customer_extras REPLICA IDENTITY FULL;

-- 6) auto_templates
CREATE TABLE public.auto_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  template_id text NOT NULL,
  categoria text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  body text,
  channels jsonb,
  time_window jsonb,
  extra jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, template_id)
);
CREATE INDEX auto_templates_company_idx ON public.auto_templates(company_id, categoria);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_templates TO authenticated;
GRANT ALL ON public.auto_templates TO service_role;
ALTER TABLE public.auto_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auto_templates_company_access" ON public.auto_templates
  FOR ALL TO authenticated
  USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));
CREATE TRIGGER auto_templates_touch BEFORE UPDATE ON public.auto_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.auto_templates REPLICA IDENTITY FULL;

-- 7) revenda_settings
CREATE TABLE public.revenda_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenda_settings TO authenticated;
GRANT ALL ON public.revenda_settings TO service_role;
ALTER TABLE public.revenda_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "revenda_settings_company_access" ON public.revenda_settings
  FOR ALL TO authenticated
  USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));
CREATE TRIGGER revenda_settings_touch BEFORE UPDATE ON public.revenda_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.revenda_settings REPLICA IDENTITY FULL;

-- ============================================================================
-- REALTIME: publicar todas as tabelas críticas
-- (DO blocks para ignorar erro caso já estejam na publication)
-- ============================================================================
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'trial_leads','trial_followups',
    'finance_entries','finance_goals',
    'customer_extras','auto_templates','revenda_settings',
    'customers','service_plans','screens','servers'
  ]) LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END;
    BEGIN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    EXCEPTION
      WHEN undefined_table THEN NULL;
    END;
  END LOOP;
END $$;