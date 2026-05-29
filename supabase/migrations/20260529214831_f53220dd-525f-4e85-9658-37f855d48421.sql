CREATE TABLE IF NOT EXISTS public.referral_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL UNIQUE,
  meta integer NOT NULL DEFAULT 2,
  tipo text NOT NULL DEFAULT '1mes',
  descricao text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_rules TO authenticated;
GRANT ALL ON public.referral_rules TO service_role;

ALTER TABLE public.referral_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view referral_rules"
  ON public.referral_rules FOR SELECT TO authenticated
  USING (has_company_access(company_id));

CREATE POLICY "members insert referral_rules"
  ON public.referral_rules FOR INSERT TO authenticated
  WITH CHECK (has_company_access(company_id));

CREATE POLICY "members update referral_rules"
  ON public.referral_rules FOR UPDATE TO authenticated
  USING (has_company_access(company_id))
  WITH CHECK (has_company_access(company_id));

CREATE POLICY "members delete referral_rules"
  ON public.referral_rules FOR DELETE TO authenticated
  USING (has_company_access(company_id));

CREATE OR REPLACE FUNCTION public.touch_referral_rules_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_referral_rules_updated_at
  BEFORE UPDATE ON public.referral_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_referral_rules_updated_at();