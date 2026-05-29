
-- ============================================================
-- dns_domains
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dns_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  domain text NOT NULL,
  provider text NOT NULL DEFAULT 'outro',
  status text NOT NULL DEFAULT 'em_configuracao',
  notes text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS dns_domains_company_domain_uniq
  ON public.dns_domains (company_id, lower(domain));
CREATE INDEX IF NOT EXISTS dns_domains_company_idx
  ON public.dns_domains (company_id) WHERE archived = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dns_domains TO authenticated;
GRANT ALL ON public.dns_domains TO service_role;

ALTER TABLE public.dns_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view dns_domains" ON public.dns_domains
  FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY "members insert dns_domains" ON public.dns_domains
  FOR INSERT TO authenticated WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members update dns_domains" ON public.dns_domains
  FOR UPDATE TO authenticated USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members delete dns_domains" ON public.dns_domains
  FOR DELETE TO authenticated USING (public.has_company_access(company_id));

CREATE TRIGGER dns_domains_touch_updated_at
  BEFORE UPDATE ON public.dns_domains
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- dns_routes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dns_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  domain_id uuid NOT NULL REFERENCES public.dns_domains(id) ON DELETE CASCADE,
  server_id uuid,
  subdomain text NOT NULL DEFAULT '',
  host text NOT NULL,
  destination text NOT NULL DEFAULT '',
  previous_value text,
  record_type text NOT NULL DEFAULT 'CNAME',
  environment text NOT NULL DEFAULT 'producao',
  is_active boolean NOT NULL DEFAULT true,
  is_primary boolean NOT NULL DEFAULT false,
  is_backup boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'aguardando_dns',
  notes text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dns_routes_company_idx
  ON public.dns_routes (company_id) WHERE archived = false;
CREATE INDEX IF NOT EXISTS dns_routes_company_server_idx
  ON public.dns_routes (company_id, server_id) WHERE archived = false AND is_active = true;
CREATE INDEX IF NOT EXISTS dns_routes_company_server_primary_idx
  ON public.dns_routes (company_id, server_id)
  WHERE archived = false AND is_active = true AND is_primary = true;
CREATE INDEX IF NOT EXISTS dns_routes_domain_idx
  ON public.dns_routes (domain_id);
CREATE INDEX IF NOT EXISTS dns_routes_host_idx
  ON public.dns_routes (company_id, host);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dns_routes TO authenticated;
GRANT ALL ON public.dns_routes TO service_role;

ALTER TABLE public.dns_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view dns_routes" ON public.dns_routes
  FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY "members insert dns_routes" ON public.dns_routes
  FOR INSERT TO authenticated WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members update dns_routes" ON public.dns_routes
  FOR UPDATE TO authenticated USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members delete dns_routes" ON public.dns_routes
  FOR DELETE TO authenticated USING (public.has_company_access(company_id));

CREATE TRIGGER dns_routes_validate_domain_company
  BEFORE INSERT OR UPDATE ON public.dns_routes
  FOR EACH ROW EXECUTE FUNCTION public.cst_validate_customer_company();
-- (cst_validate validates customer; we use a simple inline check instead)

DROP TRIGGER IF EXISTS dns_routes_validate_domain_company ON public.dns_routes;

CREATE OR REPLACE FUNCTION public.dns_routes_validate_domain_company()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.dns_domains d
     WHERE d.id = NEW.domain_id AND d.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'domain_id % does not belong to company_id %', NEW.domain_id, NEW.company_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER dns_routes_validate_domain_company
  BEFORE INSERT OR UPDATE ON public.dns_routes
  FOR EACH ROW EXECUTE FUNCTION public.dns_routes_validate_domain_company();

CREATE TRIGGER dns_routes_touch_updated_at
  BEFORE UPDATE ON public.dns_routes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
