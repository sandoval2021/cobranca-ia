-- =========================================
-- FASE 2: Credenciais IPTV + Renovação assistida
-- =========================================

-- 1) SERVERS (painéis IPTV por empresa)
CREATE TABLE public.servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  panel_url text,
  panel_username text,
  panel_password_enc text,
  panel_type text NOT NULL DEFAULT 'outros',
  customer_search_url_template text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX servers_company_idx ON public.servers(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.servers TO authenticated;
GRANT ALL ON public.servers TO service_role;

ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view servers" ON public.servers
  FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY "members insert servers" ON public.servers
  FOR INSERT TO authenticated WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members update servers" ON public.servers
  FOR UPDATE TO authenticated USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "owner deletes servers" ON public.servers
  FOR DELETE TO authenticated USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = servers.company_id AND c.owner_id = auth.uid()
    )
  );

CREATE TRIGGER tg_servers_updated
  BEFORE UPDATE ON public.servers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) CUSTOMER_IPTV_CREDENTIALS
CREATE TABLE public.customer_iptv_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  server_id uuid,
  iptv_username text,
  iptv_password_enc text,
  mac text,
  device_key text,
  app_used text,
  plan_days integer,
  expires_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cic_company_idx ON public.customer_iptv_credentials(company_id);
CREATE INDEX cic_customer_idx ON public.customer_iptv_credentials(customer_id);
CREATE INDEX cic_server_idx ON public.customer_iptv_credentials(server_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_iptv_credentials TO authenticated;
GRANT ALL ON public.customer_iptv_credentials TO service_role;

ALTER TABLE public.customer_iptv_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view iptv creds" ON public.customer_iptv_credentials
  FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY "members insert iptv creds" ON public.customer_iptv_credentials
  FOR INSERT TO authenticated WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members update iptv creds" ON public.customer_iptv_credentials
  FOR UPDATE TO authenticated USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members delete iptv creds" ON public.customer_iptv_credentials
  FOR DELETE TO authenticated USING (public.has_company_access(company_id));

CREATE TRIGGER tg_cic_updated
  BEFORE UPDATE ON public.customer_iptv_credentials
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER tg_cic_validate_customer
  BEFORE INSERT OR UPDATE ON public.customer_iptv_credentials
  FOR EACH ROW EXECUTE FUNCTION public.cst_validate_customer_company();

-- 3) RENEWAL_TASKS
CREATE TABLE public.renewal_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  server_id uuid,
  credential_id uuid,
  kind text NOT NULL DEFAULT 'iptv',
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  screenshot_url text,
  assigned_to uuid,
  plan_days integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rt_company_status_idx ON public.renewal_tasks(company_id, status);
CREATE INDEX rt_customer_idx ON public.renewal_tasks(customer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.renewal_tasks TO authenticated;
GRANT ALL ON public.renewal_tasks TO service_role;

ALTER TABLE public.renewal_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view renewal_tasks" ON public.renewal_tasks
  FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY "members insert renewal_tasks" ON public.renewal_tasks
  FOR INSERT TO authenticated WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members update renewal_tasks" ON public.renewal_tasks
  FOR UPDATE TO authenticated USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members delete renewal_tasks" ON public.renewal_tasks
  FOR DELETE TO authenticated USING (public.has_company_access(company_id));

CREATE TRIGGER tg_rt_updated
  BEFORE UPDATE ON public.renewal_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) CREDENTIAL_ACCESS_LOG
CREATE TABLE public.credential_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid,
  target_kind text NOT NULL,
  target_id uuid NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cal_company_idx ON public.credential_access_log(company_id, created_at DESC);

GRANT SELECT ON public.credential_access_log TO authenticated;
GRANT ALL ON public.credential_access_log TO service_role;

ALTER TABLE public.credential_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view credential_access_log" ON public.credential_access_log
  FOR SELECT TO authenticated USING (public.has_company_access(company_id));
