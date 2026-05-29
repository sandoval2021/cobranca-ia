
-- ============== manual_renewals ==============
CREATE TABLE IF NOT EXISTS public.manual_renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  service_plan_id uuid NULL,
  old_due_date date NULL,
  new_due_date date NOT NULL,
  months_added integer NULL,
  amount_cents integer NULL,
  payment_method text NULL,
  note text NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_renewals_company ON public.manual_renewals(company_id);
CREATE INDEX IF NOT EXISTS idx_manual_renewals_customer ON public.manual_renewals(customer_id);
CREATE INDEX IF NOT EXISTS idx_manual_renewals_created ON public.manual_renewals(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_renewals TO authenticated;
GRANT ALL ON public.manual_renewals TO service_role;

ALTER TABLE public.manual_renewals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view manual_renewals"
  ON public.manual_renewals FOR SELECT TO authenticated
  USING (public.has_company_access(company_id));

CREATE POLICY "members insert manual_renewals"
  ON public.manual_renewals FOR INSERT TO authenticated
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "members update manual_renewals"
  ON public.manual_renewals FOR UPDATE TO authenticated
  USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "members delete manual_renewals"
  ON public.manual_renewals FOR DELETE TO authenticated
  USING (public.has_company_access(company_id));

-- ============== customer_due_overrides ==============
CREATE TABLE IF NOT EXISTS public.customer_due_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  due_date date NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  note text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_due_overrides_company ON public.customer_due_overrides(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_due_overrides_customer ON public.customer_due_overrides(customer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_due_overrides TO authenticated;
GRANT ALL ON public.customer_due_overrides TO service_role;

ALTER TABLE public.customer_due_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view customer_due_overrides"
  ON public.customer_due_overrides FOR SELECT TO authenticated
  USING (public.has_company_access(company_id));

CREATE POLICY "members insert customer_due_overrides"
  ON public.customer_due_overrides FOR INSERT TO authenticated
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "members update customer_due_overrides"
  ON public.customer_due_overrides FOR UPDATE TO authenticated
  USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "members delete customer_due_overrides"
  ON public.customer_due_overrides FOR DELETE TO authenticated
  USING (public.has_company_access(company_id));

CREATE TRIGGER trg_customer_due_overrides_touch
  BEFORE UPDATE ON public.customer_due_overrides
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
