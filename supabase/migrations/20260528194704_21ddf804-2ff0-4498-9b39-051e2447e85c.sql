
-- Portal apps catalog per company
CREATE TABLE public.portal_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  app_name text NOT NULL,
  panel_url text,
  panel_login text,
  panel_password_enc text,
  id_type text NOT NULL DEFAULT 'mac', -- mac | key | both
  mac_url_template text,
  key_url_template text,
  color text NOT NULL DEFAULT '#8b5cf6',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_apps TO authenticated;
GRANT ALL ON public.portal_apps TO service_role;

ALTER TABLE public.portal_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view portal_apps" ON public.portal_apps
  FOR SELECT TO authenticated USING (has_company_access(company_id));
CREATE POLICY "members insert portal_apps" ON public.portal_apps
  FOR INSERT TO authenticated WITH CHECK (has_company_access(company_id));
CREATE POLICY "members update portal_apps" ON public.portal_apps
  FOR UPDATE TO authenticated USING (has_company_access(company_id)) WITH CHECK (has_company_access(company_id));
CREATE POLICY "owner deletes portal_apps" ON public.portal_apps
  FOR DELETE TO authenticated USING (
    is_super_admin() OR EXISTS (SELECT 1 FROM companies c WHERE c.id = portal_apps.company_id AND c.owner_id = auth.uid())
  );

CREATE TRIGGER portal_apps_touch_updated_at
  BEFORE UPDATE ON public.portal_apps
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Customer x portal app devices
CREATE TABLE public.customer_portal_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  portal_app_id uuid NOT NULL,
  mac text,
  device_key text,
  current_route text,
  notes text,
  last_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_portal_devices TO authenticated;
GRANT ALL ON public.customer_portal_devices TO service_role;

ALTER TABLE public.customer_portal_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view portal devices" ON public.customer_portal_devices
  FOR SELECT TO authenticated USING (has_company_access(company_id));
CREATE POLICY "members insert portal devices" ON public.customer_portal_devices
  FOR INSERT TO authenticated WITH CHECK (has_company_access(company_id));
CREATE POLICY "members update portal devices" ON public.customer_portal_devices
  FOR UPDATE TO authenticated USING (has_company_access(company_id)) WITH CHECK (has_company_access(company_id));
CREATE POLICY "members delete portal devices" ON public.customer_portal_devices
  FOR DELETE TO authenticated USING (has_company_access(company_id));

CREATE TRIGGER customer_portal_devices_touch_updated_at
  BEFORE UPDATE ON public.customer_portal_devices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_portal_devices_customer ON public.customer_portal_devices(customer_id);
CREATE INDEX idx_portal_devices_app ON public.customer_portal_devices(portal_app_id);
CREATE INDEX idx_portal_apps_company ON public.portal_apps(company_id);
