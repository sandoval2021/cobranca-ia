CREATE TABLE IF NOT EXISTS public.finance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_settings_company_unique UNIQUE (company_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_settings TO authenticated;
GRANT ALL ON public.finance_settings TO service_role;

ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view finance_settings"
ON public.finance_settings FOR SELECT TO authenticated
USING (public.has_company_access(company_id));

CREATE POLICY "members insert finance_settings"
ON public.finance_settings FOR INSERT TO authenticated
WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "members update finance_settings"
ON public.finance_settings FOR UPDATE TO authenticated
USING (public.has_company_access(company_id))
WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "members delete finance_settings"
ON public.finance_settings FOR DELETE TO authenticated
USING (public.has_company_access(company_id));

DROP TRIGGER IF EXISTS trg_finance_settings_touch_updated_at ON public.finance_settings;
CREATE TRIGGER trg_finance_settings_touch_updated_at
BEFORE UPDATE ON public.finance_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_finance_settings_company ON public.finance_settings(company_id);