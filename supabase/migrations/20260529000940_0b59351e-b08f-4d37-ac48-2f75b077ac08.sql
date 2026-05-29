
-- ============ company_ai_knowledge ============
CREATE TABLE public.company_ai_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE,
  knowledge_text text NOT NULL DEFAULT '',
  tone text NOT NULL DEFAULT 'profissional',
  answer_length text NOT NULL DEFAULT 'media',
  allow_after_hours boolean NOT NULL DEFAULT true,
  accepts_audio boolean NOT NULL DEFAULT false,
  auto_offer_trial boolean NOT NULL DEFAULT false,
  human_on_complaint boolean NOT NULL DEFAULT true,
  human_when_unsure boolean NOT NULL DEFAULT true,
  allow_paid_apps_info boolean NOT NULL DEFAULT true,
  use_manual_pix_fallback boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_ai_knowledge TO authenticated;
GRANT ALL ON public.company_ai_knowledge TO service_role;

ALTER TABLE public.company_ai_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view company_ai_knowledge" ON public.company_ai_knowledge
  FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY "members insert company_ai_knowledge" ON public.company_ai_knowledge
  FOR INSERT TO authenticated WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members update company_ai_knowledge" ON public.company_ai_knowledge
  FOR UPDATE TO authenticated USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members delete company_ai_knowledge" ON public.company_ai_knowledge
  FOR DELETE TO authenticated USING (public.has_company_access(company_id));

CREATE TRIGGER trg_company_ai_knowledge_updated
  BEFORE UPDATE ON public.company_ai_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ company_ai_faqs ============
CREATE TABLE public.company_ai_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'outros',
  question text NOT NULL,
  answer text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_company_ai_faqs_company ON public.company_ai_faqs(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_ai_faqs TO authenticated;
GRANT ALL ON public.company_ai_faqs TO service_role;

ALTER TABLE public.company_ai_faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view company_ai_faqs" ON public.company_ai_faqs
  FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY "members insert company_ai_faqs" ON public.company_ai_faqs
  FOR INSERT TO authenticated WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members update company_ai_faqs" ON public.company_ai_faqs
  FOR UPDATE TO authenticated USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members delete company_ai_faqs" ON public.company_ai_faqs
  FOR DELETE TO authenticated USING (public.has_company_access(company_id));

CREATE TRIGGER trg_company_ai_faqs_updated
  BEFORE UPDATE ON public.company_ai_faqs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ company_ai_payment_settings ============
CREATE TABLE public.company_ai_payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE,
  manual_pix_key text,
  manual_pix_holder text,
  manual_pix_bank text,
  payment_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_ai_payment_settings TO authenticated;
GRANT ALL ON public.company_ai_payment_settings TO service_role;

ALTER TABLE public.company_ai_payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view company_ai_payment_settings" ON public.company_ai_payment_settings
  FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY "members insert company_ai_payment_settings" ON public.company_ai_payment_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members update company_ai_payment_settings" ON public.company_ai_payment_settings
  FOR UPDATE TO authenticated USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members delete company_ai_payment_settings" ON public.company_ai_payment_settings
  FOR DELETE TO authenticated USING (public.has_company_access(company_id));

CREATE TRIGGER trg_company_ai_payment_settings_updated
  BEFORE UPDATE ON public.company_ai_payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ company_ai_app_guides ============
CREATE TABLE public.company_ai_app_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  app_name text NOT NULL,
  is_paid boolean NOT NULL DEFAULT false,
  app_price_cents integer NOT NULL DEFAULT 0,
  login_type text NOT NULL DEFAULT 'user_pass',
  install_steps text,
  update_steps text,
  cache_steps text,
  route_steps text,
  common_issues text,
  default_reply text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_company_ai_app_guides_company ON public.company_ai_app_guides(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_ai_app_guides TO authenticated;
GRANT ALL ON public.company_ai_app_guides TO service_role;

ALTER TABLE public.company_ai_app_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view company_ai_app_guides" ON public.company_ai_app_guides
  FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY "members insert company_ai_app_guides" ON public.company_ai_app_guides
  FOR INSERT TO authenticated WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members update company_ai_app_guides" ON public.company_ai_app_guides
  FOR UPDATE TO authenticated USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members delete company_ai_app_guides" ON public.company_ai_app_guides
  FOR DELETE TO authenticated USING (public.has_company_access(company_id));

CREATE TRIGGER trg_company_ai_app_guides_updated
  BEFORE UPDATE ON public.company_ai_app_guides
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
