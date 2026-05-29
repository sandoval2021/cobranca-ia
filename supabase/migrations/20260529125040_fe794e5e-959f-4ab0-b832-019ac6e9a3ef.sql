
CREATE TABLE public.customer_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  referrer_customer_id uuid NULL,
  referred_customer_id uuid NULL,
  referrer_name text NULL,
  referrer_phone text NULL,
  referred_name text NULL,
  referred_phone text NULL,
  status text NOT NULL DEFAULT 'pending',
  reward_status text NOT NULL DEFAULT 'none',
  closed_at timestamptz NULL,
  reward_applied_at timestamptz NULL,
  note text NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_referrals TO authenticated;
GRANT ALL ON public.customer_referrals TO service_role;
ALTER TABLE public.customer_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view customer_referrals" ON public.customer_referrals FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY "members insert customer_referrals" ON public.customer_referrals FOR INSERT TO authenticated WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members update customer_referrals" ON public.customer_referrals FOR UPDATE TO authenticated USING (public.has_company_access(company_id)) WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members delete customer_referrals" ON public.customer_referrals FOR DELETE TO authenticated USING (public.has_company_access(company_id));
CREATE INDEX idx_customer_referrals_company ON public.customer_referrals(company_id);
CREATE INDEX idx_customer_referrals_referrer ON public.customer_referrals(company_id, referrer_phone);
CREATE TRIGGER trg_customer_referrals_touch BEFORE UPDATE ON public.customer_referrals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.ai_knowledge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'regra',
  app text NULL,
  keywords text[] NOT NULL DEFAULT '{}'::text[],
  short_text text NOT NULL DEFAULT '',
  full_text text NOT NULL DEFAULT '',
  when_to_use text NULL,
  when_not_to_use text NULL,
  needs_human boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_knowledge_entries TO authenticated;
GRANT ALL ON public.ai_knowledge_entries TO service_role;
ALTER TABLE public.ai_knowledge_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view ai_knowledge_entries" ON public.ai_knowledge_entries FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY "members insert ai_knowledge_entries" ON public.ai_knowledge_entries FOR INSERT TO authenticated WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members update ai_knowledge_entries" ON public.ai_knowledge_entries FOR UPDATE TO authenticated USING (public.has_company_access(company_id)) WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members delete ai_knowledge_entries" ON public.ai_knowledge_entries FOR DELETE TO authenticated USING (public.has_company_access(company_id));
CREATE INDEX idx_ai_knowledge_entries_company ON public.ai_knowledge_entries(company_id);
CREATE TRIGGER trg_ai_knowledge_entries_touch BEFORE UPDATE ON public.ai_knowledge_entries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.manual_dispatch_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  rule_key text NOT NULL,
  name text NOT NULL,
  days_offset integer NOT NULL DEFAULT 0,
  rule_type text NOT NULL DEFAULT 'lembrete',
  priority text NOT NULL DEFAULT 'media',
  tone text NOT NULL DEFAULT 'amigavel',
  template text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, rule_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_dispatch_rules TO authenticated;
GRANT ALL ON public.manual_dispatch_rules TO service_role;
ALTER TABLE public.manual_dispatch_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view manual_dispatch_rules" ON public.manual_dispatch_rules FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY "members insert manual_dispatch_rules" ON public.manual_dispatch_rules FOR INSERT TO authenticated WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members update manual_dispatch_rules" ON public.manual_dispatch_rules FOR UPDATE TO authenticated USING (public.has_company_access(company_id)) WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members delete manual_dispatch_rules" ON public.manual_dispatch_rules FOR DELETE TO authenticated USING (public.has_company_access(company_id));
CREATE INDEX idx_manual_dispatch_rules_company ON public.manual_dispatch_rules(company_id);
CREATE TRIGGER trg_manual_dispatch_rules_touch BEFORE UPDATE ON public.manual_dispatch_rules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.customer_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  filename text NULL,
  status text NOT NULL DEFAULT 'pending',
  total_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  failed_rows integer NOT NULL DEFAULT 0,
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_import_jobs TO authenticated;
GRANT ALL ON public.customer_import_jobs TO service_role;
ALTER TABLE public.customer_import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view customer_import_jobs" ON public.customer_import_jobs FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY "members insert customer_import_jobs" ON public.customer_import_jobs FOR INSERT TO authenticated WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members update customer_import_jobs" ON public.customer_import_jobs FOR UPDATE TO authenticated USING (public.has_company_access(company_id)) WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members delete customer_import_jobs" ON public.customer_import_jobs FOR DELETE TO authenticated USING (public.has_company_access(company_id));
CREATE INDEX idx_customer_import_jobs_company ON public.customer_import_jobs(company_id, created_at DESC);
CREATE TRIGGER trg_customer_import_jobs_touch BEFORE UPDATE ON public.customer_import_jobs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.imported_customer_due_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  customer_id uuid NULL,
  phone text NULL,
  customer_name text NULL,
  due_date date NOT NULL,
  source_job_id uuid NULL,
  raw_row jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imported_customer_due_dates TO authenticated;
GRANT ALL ON public.imported_customer_due_dates TO service_role;
ALTER TABLE public.imported_customer_due_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view imported_due" ON public.imported_customer_due_dates FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY "members insert imported_due" ON public.imported_customer_due_dates FOR INSERT TO authenticated WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members update imported_due" ON public.imported_customer_due_dates FOR UPDATE TO authenticated USING (public.has_company_access(company_id)) WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members delete imported_due" ON public.imported_customer_due_dates FOR DELETE TO authenticated USING (public.has_company_access(company_id));
CREATE INDEX idx_imported_due_company ON public.imported_customer_due_dates(company_id);
CREATE UNIQUE INDEX uniq_imported_due_company_phone ON public.imported_customer_due_dates(company_id, phone) WHERE phone IS NOT NULL;
