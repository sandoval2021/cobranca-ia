-- 1) Tabela de idempotência (marker) para consumo de IA.
CREATE TABLE IF NOT EXISTS public.ai_usage_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  cycle_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_usage_idempotency_unique UNIQUE (company_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_idempotency_company_created
  ON public.ai_usage_idempotency (company_id, created_at DESC);

-- Tabela de uso interno do backend (service_role). Sem acesso para clients.
GRANT ALL ON public.ai_usage_idempotency TO service_role;

ALTER TABLE public.ai_usage_idempotency ENABLE ROW LEVEL SECURITY;

-- Apenas leitura para membros (auditoria opcional). Sem INSERT/UPDATE/DELETE de clientes.
CREATE POLICY "members view ai_usage_idempotency"
  ON public.ai_usage_idempotency
  FOR SELECT
  TO authenticated
  USING (public.has_company_access(company_id));

-- 2) RPC idempotente. Mantém increment_ai_usage(uuid) original intacto.
CREATE OR REPLACE FUNCTION public.increment_ai_usage_idempotent(
  _company_id uuid,
  _idempotency_key text
) RETURNS public.company_ai_usage_cycle
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle public.company_ai_usage_cycle;
  v_key   text := NULLIF(btrim(COALESCE(_idempotency_key, '')), '');
BEGIN
  v_cycle := public.get_or_create_current_ai_cycle(_company_id);

  -- Sem chave: comportamento antigo (compatível).
  IF v_key IS NULL THEN
    UPDATE public.company_ai_usage_cycle
       SET used_count = used_count + 1,
           last_increment_at = now(),
           updated_at = now()
     WHERE id = v_cycle.id
     RETURNING * INTO v_cycle;
    RETURN v_cycle;
  END IF;

  -- Com chave: tenta marcar idempotência. Conflict = já contado.
  BEGIN
    INSERT INTO public.ai_usage_idempotency (company_id, idempotency_key, cycle_id)
    VALUES (_company_id, v_key, v_cycle.id);
  EXCEPTION WHEN unique_violation THEN
    RETURN v_cycle;
  END;

  UPDATE public.company_ai_usage_cycle
     SET used_count = used_count + 1,
         last_increment_at = now(),
         updated_at = now()
   WHERE id = v_cycle.id
   RETURNING * INTO v_cycle;
  RETURN v_cycle;
END;
$$;