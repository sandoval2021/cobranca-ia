
-- Price groups (tabelas de preço configuráveis por empresa)
CREATE TABLE public.price_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  ai_notes text,
  priority int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX price_groups_one_default_per_company
  ON public.price_groups(company_id) WHERE is_default = true;
CREATE INDEX price_groups_company_idx ON public.price_groups(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_groups TO authenticated;
GRANT ALL ON public.price_groups TO service_role;
ALTER TABLE public.price_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view price_groups" ON public.price_groups
  FOR SELECT TO authenticated USING (has_company_access(company_id));
CREATE POLICY "members insert price_groups" ON public.price_groups
  FOR INSERT TO authenticated WITH CHECK (has_company_access(company_id));
CREATE POLICY "members update price_groups" ON public.price_groups
  FOR UPDATE TO authenticated USING (has_company_access(company_id))
  WITH CHECK (has_company_access(company_id));
CREATE POLICY "members delete price_groups" ON public.price_groups
  FOR DELETE TO authenticated USING (has_company_access(company_id));

CREATE TRIGGER price_groups_touch BEFORE UPDATE ON public.price_groups
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Planos dentro do grupo
CREATE TABLE public.price_group_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  price_group_id uuid NOT NULL REFERENCES public.price_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  screens int NOT NULL DEFAULT 1,
  duration_days int NOT NULL DEFAULT 30,
  price_cents int NOT NULL DEFAULT 0,
  allow_installments boolean NOT NULL DEFAULT false,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX price_group_plans_group_idx ON public.price_group_plans(price_group_id);
CREATE INDEX price_group_plans_company_idx ON public.price_group_plans(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_group_plans TO authenticated;
GRANT ALL ON public.price_group_plans TO service_role;
ALTER TABLE public.price_group_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view price_group_plans" ON public.price_group_plans
  FOR SELECT TO authenticated USING (has_company_access(company_id));
CREATE POLICY "members insert price_group_plans" ON public.price_group_plans
  FOR INSERT TO authenticated WITH CHECK (has_company_access(company_id));
CREATE POLICY "members update price_group_plans" ON public.price_group_plans
  FOR UPDATE TO authenticated USING (has_company_access(company_id))
  WITH CHECK (has_company_access(company_id));
CREATE POLICY "members delete price_group_plans" ON public.price_group_plans
  FOR DELETE TO authenticated USING (has_company_access(company_id));

CREATE TRIGGER price_group_plans_touch BEFORE UPDATE ON public.price_group_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Base de conhecimento de apps suportados
CREATE TABLE public.app_support_kb (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  app_name text NOT NULL,
  login_type text NOT NULL DEFAULT 'user_pass' CHECK (login_type IN ('user_pass','mac_key','other')),
  is_paid boolean NOT NULL DEFAULT false,
  stability_level text NOT NULL DEFAULT 'stable' CHECK (stability_level IN ('stable','medium','unstable')),
  how_to_update text,
  how_to_change_route text,
  common_issues text,
  default_reply text,
  escalate_when text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX app_support_kb_company_idx ON public.app_support_kb(company_id);
CREATE UNIQUE INDEX app_support_kb_company_app_idx
  ON public.app_support_kb(company_id, lower(app_name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_support_kb TO authenticated;
GRANT ALL ON public.app_support_kb TO service_role;
ALTER TABLE public.app_support_kb ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view app_support_kb" ON public.app_support_kb
  FOR SELECT TO authenticated USING (has_company_access(company_id));
CREATE POLICY "members insert app_support_kb" ON public.app_support_kb
  FOR INSERT TO authenticated WITH CHECK (has_company_access(company_id));
CREATE POLICY "members update app_support_kb" ON public.app_support_kb
  FOR UPDATE TO authenticated USING (has_company_access(company_id))
  WITH CHECK (has_company_access(company_id));
CREATE POLICY "members delete app_support_kb" ON public.app_support_kb
  FOR DELETE TO authenticated USING (has_company_access(company_id));

CREATE TRIGGER app_support_kb_touch BEFORE UPDATE ON public.app_support_kb
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Configurações gerais da IA por empresa
CREATE TABLE public.ai_company_settings (
  company_id uuid PRIMARY KEY,
  support_instructions text,
  ask_referral_for_new boolean NOT NULL DEFAULT true,
  escalate_when_referrer_missing boolean NOT NULL DEFAULT true,
  human_handoff_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_company_settings TO authenticated;
GRANT ALL ON public.ai_company_settings TO service_role;
ALTER TABLE public.ai_company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view ai_company_settings" ON public.ai_company_settings
  FOR SELECT TO authenticated USING (has_company_access(company_id));
CREATE POLICY "members insert ai_company_settings" ON public.ai_company_settings
  FOR INSERT TO authenticated WITH CHECK (has_company_access(company_id));
CREATE POLICY "members update ai_company_settings" ON public.ai_company_settings
  FOR UPDATE TO authenticated USING (has_company_access(company_id))
  WITH CHECK (has_company_access(company_id));

CREATE TRIGGER ai_company_settings_touch BEFORE UPDATE ON public.ai_company_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Colunas em customers para grupo de preço e indicação
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS price_group_id uuid,
  ADD COLUMN IF NOT EXISTS referral_customer_id uuid,
  ADD COLUMN IF NOT EXISTS referral_raw text;

CREATE INDEX IF NOT EXISTS customers_price_group_idx ON public.customers(price_group_id);
CREATE INDEX IF NOT EXISTS customers_referral_idx ON public.customers(referral_customer_id);
