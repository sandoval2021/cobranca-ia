-- Trial padrão = 7 dias (era 30)
ALTER TABLE public.company_subscriptions
  ALTER COLUMN current_period_end SET DEFAULT (now() + interval '7 days');

-- Ajusta trials existentes para 7 dias a partir do início
UPDATE public.company_subscriptions
   SET current_period_end = current_period_start + interval '7 days',
       updated_at = now()
 WHERE status = 'trial';

-- Tabela para sessões de checkout SaaS (pagamento do próprio plano CobraEasy via MP da plataforma)
CREATE TABLE IF NOT EXISTS public.saas_checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  preference_id text,
  external_reference text NOT NULL,
  init_point text,
  status text NOT NULL DEFAULT 'pending',
  amount_cents integer NOT NULL DEFAULT 0,
  mp_payment_id text,
  paid_at timestamptz,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.saas_checkout_sessions TO authenticated;
GRANT ALL    ON public.saas_checkout_sessions TO service_role;

ALTER TABLE public.saas_checkout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view their saas_checkout_sessions"
  ON public.saas_checkout_sessions
  FOR SELECT TO authenticated
  USING (public.has_company_access(company_id));

CREATE INDEX IF NOT EXISTS idx_saas_checkout_external_ref
  ON public.saas_checkout_sessions (external_reference);
CREATE INDEX IF NOT EXISTS idx_saas_checkout_company
  ON public.saas_checkout_sessions (company_id);

-- RPC para ativar plano após pagamento aprovado (chamada do webhook com service_role)
CREATE OR REPLACE FUNCTION public.activate_saas_subscription(
  _company_id uuid,
  _plan_id uuid,
  _period_days integer DEFAULT 30
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := now();
  v_end   timestamptz := now() + (_period_days || ' days')::interval;
BEGIN
  INSERT INTO public.company_subscriptions
    (company_id, plan_id, status, current_period_start, current_period_end, last_payment_at, updated_at)
  VALUES
    (_company_id, _plan_id, 'active', v_start, v_end, v_start, v_start)
  ON CONFLICT (company_id) DO UPDATE
    SET plan_id              = EXCLUDED.plan_id,
        status               = 'active',
        current_period_start = EXCLUDED.current_period_start,
        current_period_end   = EXCLUDED.current_period_end,
        last_payment_at      = EXCLUDED.last_payment_at,
        updated_at           = now();

  -- Recria ciclo de IA para o novo período
  DELETE FROM public.company_ai_usage_cycle
   WHERE company_id = _company_id
     AND cycle_end > now();
END;
$$;