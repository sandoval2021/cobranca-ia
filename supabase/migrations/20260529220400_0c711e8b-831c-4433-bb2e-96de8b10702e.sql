-- Setup wizard progress por empresa (Fase F2B).
-- 1 linha por empresa. Progresso visual + observações de cada etapa.
CREATE TABLE IF NOT EXISTS public.company_setup_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL UNIQUE,
  steps jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_setup_progress TO authenticated;
GRANT ALL ON public.company_setup_progress TO service_role;

ALTER TABLE public.company_setup_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view company_setup_progress"
  ON public.company_setup_progress
  FOR SELECT
  TO authenticated
  USING (public.has_company_access(company_id));

CREATE POLICY "members insert company_setup_progress"
  ON public.company_setup_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "members update company_setup_progress"
  ON public.company_setup_progress
  FOR UPDATE
  TO authenticated
  USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "members delete company_setup_progress"
  ON public.company_setup_progress
  FOR DELETE
  TO authenticated
  USING (public.has_company_access(company_id));

CREATE TRIGGER touch_company_setup_progress_updated_at
  BEFORE UPDATE ON public.company_setup_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();