-- 1. ai_usage_log
CREATE TYPE public.ai_usage_type AS ENUM ('owner', 'customer');
CREATE TYPE public.ai_usage_status AS ENUM ('success', 'error');

CREATE TABLE public.ai_usage_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id             uuid,
  customer_id         uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  usage_type          public.ai_usage_type NOT NULL,
  model               text NOT NULL CHECK (char_length(model) BETWEEN 1 AND 100),
  prompt_tokens       integer NOT NULL DEFAULT 0 CHECK (prompt_tokens     >= 0),
  completion_tokens   integer NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
  total_tokens        integer NOT NULL DEFAULT 0 CHECK (total_tokens      >= 0),
  estimated_cost_usd  numeric(12,6) NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  status              public.ai_usage_status NOT NULL,
  error_reason        text CHECK (error_reason IS NULL OR char_length(error_reason) <= 500),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_log_company_created ON public.ai_usage_log(company_id, created_at DESC);
CREATE INDEX idx_ai_usage_log_customer        ON public.ai_usage_log(customer_id);

GRANT SELECT ON public.ai_usage_log TO authenticated;
GRANT ALL    ON public.ai_usage_log TO service_role;

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view company ai usage"
  ON public.ai_usage_log FOR SELECT TO authenticated
  USING (public.has_company_access(company_id));

-- 2. customer_support_tokens
CREATE TABLE public.customer_support_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash   text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id  uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  expires_at   timestamptz NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid NOT NULL
);

CREATE INDEX idx_cst_company  ON public.customer_support_tokens(company_id);
CREATE INDEX idx_cst_customer ON public.customer_support_tokens(customer_id);

CREATE OR REPLACE FUNCTION public.cst_validate_customer_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = NEW.customer_id AND c.company_id = NEW.company_id
    ) THEN
      RAISE EXCEPTION 'customer_id % does not belong to company_id %',
        NEW.customer_id, NEW.company_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cst_validate_customer_company() FROM PUBLIC;

CREATE TRIGGER trg_cst_validate_customer_company
BEFORE INSERT OR UPDATE ON public.customer_support_tokens
FOR EACH ROW EXECUTE FUNCTION public.cst_validate_customer_company();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_support_tokens TO authenticated;
GRANT ALL ON public.customer_support_tokens TO service_role;

ALTER TABLE public.customer_support_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view company tokens"
  ON public.customer_support_tokens FOR SELECT TO authenticated
  USING (public.has_company_access(company_id));

CREATE POLICY "members create company tokens"
  ON public.customer_support_tokens FOR INSERT TO authenticated
  WITH CHECK (public.has_company_access(company_id) AND created_by = auth.uid());

CREATE POLICY "members update company tokens"
  ON public.customer_support_tokens FOR UPDATE TO authenticated
  USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "owner or super_admin deletes tokens"
  ON public.customer_support_tokens FOR DELETE TO authenticated
  USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = customer_support_tokens.company_id AND c.owner_id = auth.uid()
    )
  );