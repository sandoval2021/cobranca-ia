
-- ============ 1. SaaS plans (catálogo) ============
CREATE TABLE public.saas_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0,
  ai_monthly_limit integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.saas_plans TO authenticated;
GRANT ALL ON public.saas_plans TO service_role;
ALTER TABLE public.saas_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone authed can view active plans" ON public.saas_plans
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "super_admin manages plans" ON public.saas_plans
  FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ============ 2. SaaS extra packs ============
CREATE TABLE public.saas_extra_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  ai_extra_responses integer NOT NULL DEFAULT 0,
  price_cents integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.saas_extra_packs TO authenticated;
GRANT ALL ON public.saas_extra_packs TO service_role;
ALTER TABLE public.saas_extra_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone authed can view extra packs" ON public.saas_extra_packs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "super_admin manages extra packs" ON public.saas_extra_packs
  FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ============ 3. Assinatura por empresa ============
CREATE TABLE public.company_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE,
  plan_id uuid NOT NULL REFERENCES public.saas_plans(id),
  status text NOT NULL DEFAULT 'trial', -- trial|active|past_due|canceled|paused_limit
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  last_payment_at timestamptz,
  paused_limit_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_company_subscriptions_company ON public.company_subscriptions(company_id);
GRANT SELECT ON public.company_subscriptions TO authenticated;
GRANT ALL ON public.company_subscriptions TO service_role;
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view subscription" ON public.company_subscriptions
  FOR SELECT TO authenticated USING (has_company_access(company_id));
CREATE POLICY "super_admin manages subscriptions" ON public.company_subscriptions
  FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ============ 4. Ciclo de uso de IA (contador mensal) ============
CREATE TABLE public.company_ai_usage_cycle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  cycle_start timestamptz NOT NULL,
  cycle_end timestamptz NOT NULL,
  base_limit integer NOT NULL DEFAULT 0,
  extra_limit integer NOT NULL DEFAULT 0,
  used_count integer NOT NULL DEFAULT 0,
  last_increment_at timestamptz,
  warned_70_at timestamptz,
  warned_90_at timestamptz,
  blocked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, cycle_start)
);
CREATE INDEX idx_ai_cycle_company_period ON public.company_ai_usage_cycle(company_id, cycle_start DESC);
GRANT SELECT ON public.company_ai_usage_cycle TO authenticated;
GRANT ALL ON public.company_ai_usage_cycle TO service_role;
ALTER TABLE public.company_ai_usage_cycle ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view ai cycle" ON public.company_ai_usage_cycle
  FOR SELECT TO authenticated USING (has_company_access(company_id));

-- ============ 5. Compras de pacotes extras ============
CREATE TABLE public.company_extra_pack_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  pack_id uuid NOT NULL REFERENCES public.saas_extra_packs(id),
  cycle_start timestamptz NOT NULL,
  extra_responses integer NOT NULL DEFAULT 0,
  price_cents integer NOT NULL DEFAULT 0,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_extra_purchases_company_cycle ON public.company_extra_pack_purchases(company_id, cycle_start);
GRANT SELECT ON public.company_extra_pack_purchases TO authenticated;
GRANT ALL ON public.company_extra_pack_purchases TO service_role;
ALTER TABLE public.company_extra_pack_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view extra purchases" ON public.company_extra_pack_purchases
  FOR SELECT TO authenticated USING (has_company_access(company_id));

-- ============ 6. Seeds dos planos e pacotes ============
INSERT INTO public.saas_plans (slug, name, price_cents, ai_monthly_limit, sort_order, description) VALUES
  ('essencial',    'Essencial',    4990,  5000, 1, 'Para começar — até 5.000 respostas de IA por mês'),
  ('profissional','Profissional', 11990, 15000, 2, 'Para crescer — até 15.000 respostas de IA por mês'),
  ('escala',       'Escala',      24990, 50000, 3, 'Operação madura — até 50.000 respostas de IA por mês');

INSERT INTO public.saas_extra_packs (slug, name, ai_extra_responses, price_cents, sort_order) VALUES
  ('pack-2k',  '+2.000 respostas',   2000,  1990, 1),
  ('pack-5k',  '+5.000 respostas',   5000,  3990, 2),
  ('pack-10k', '+10.000 respostas', 10000,  6990, 3);

-- ============ 7. Assinatura padrão para empresas existentes (trial Profissional 30 dias) ============
INSERT INTO public.company_subscriptions (company_id, plan_id, status, current_period_start, current_period_end)
SELECT c.id,
       (SELECT id FROM public.saas_plans WHERE slug = 'profissional' LIMIT 1),
       'trial',
       now(),
       now() + interval '30 days'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.company_subscriptions s WHERE s.company_id = c.id);

-- ============ 8. Função: pega/cria ciclo de uso atual da empresa ============
CREATE OR REPLACE FUNCTION public.get_or_create_current_ai_cycle(_company_id uuid)
RETURNS public.company_ai_usage_cycle
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
  v_plan record;
  v_extra integer;
  v_cycle public.company_ai_usage_cycle;
BEGIN
  SELECT * INTO v_sub FROM public.company_subscriptions WHERE company_id = _company_id;
  IF NOT FOUND THEN
    -- cria assinatura trial default Profissional
    INSERT INTO public.company_subscriptions (company_id, plan_id, status)
    SELECT _company_id, id, 'trial' FROM public.saas_plans WHERE slug = 'profissional' LIMIT 1
    RETURNING * INTO v_sub;
  END IF;

  SELECT * INTO v_plan FROM public.saas_plans WHERE id = v_sub.plan_id;

  -- existe ciclo cobrindo agora?
  SELECT * INTO v_cycle
  FROM public.company_ai_usage_cycle
  WHERE company_id = _company_id
    AND cycle_start <= now()
    AND cycle_end > now()
  ORDER BY cycle_start DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN v_cycle;
  END IF;

  -- soma extras comprados no ciclo da assinatura
  SELECT COALESCE(SUM(extra_responses), 0) INTO v_extra
  FROM public.company_extra_pack_purchases
  WHERE company_id = _company_id
    AND cycle_start = v_sub.current_period_start;

  INSERT INTO public.company_ai_usage_cycle (
    company_id, cycle_start, cycle_end, base_limit, extra_limit, used_count
  ) VALUES (
    _company_id,
    v_sub.current_period_start,
    v_sub.current_period_end,
    COALESCE(v_plan.ai_monthly_limit, 0),
    v_extra,
    0
  )
  ON CONFLICT (company_id, cycle_start) DO UPDATE SET updated_at = now()
  RETURNING * INTO v_cycle;

  RETURN v_cycle;
END;
$$;

-- ============ 9. Função: incrementa uso (atomic) ============
CREATE OR REPLACE FUNCTION public.increment_ai_usage(_company_id uuid)
RETURNS public.company_ai_usage_cycle
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle public.company_ai_usage_cycle;
BEGIN
  v_cycle := public.get_or_create_current_ai_cycle(_company_id);
  UPDATE public.company_ai_usage_cycle
     SET used_count = used_count + 1,
         last_increment_at = now(),
         updated_at = now()
   WHERE id = v_cycle.id
   RETURNING * INTO v_cycle;
  RETURN v_cycle;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_current_ai_cycle(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_ai_usage(uuid) TO service_role;
