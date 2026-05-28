
CREATE TYPE public.app_role AS ENUM ('super_admin', 'owner', 'member');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'super_admin')
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;

CREATE POLICY "users see own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_super_admin());

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_members TO authenticated;
GRANT ALL ON public.company_members TO service_role;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_company_members_user ON public.company_members (user_id);
CREATE INDEX idx_company_members_company ON public.company_members (company_id);

CREATE OR REPLACE FUNCTION public.has_company_access(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = _company_id AND user_id = auth.uid()
  )
$$;
GRANT EXECUTE ON FUNCTION public.has_company_access(uuid) TO authenticated, service_role;

CREATE POLICY "members view their companies" ON public.companies
  FOR SELECT TO authenticated USING (public.has_company_access(id));
CREATE POLICY "users create companies they own" ON public.companies
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner or super_admin updates company" ON public.companies
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (owner_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "members view membership of their companies" ON public.company_members
  FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY "owner manages members - insert" ON public.company_members
  FOR INSERT TO authenticated WITH CHECK (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()
    )
  );
CREATE POLICY "owner manages members - update" ON public.company_members
  FOR UPDATE TO authenticated USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()
    )
  );
CREATE POLICY "owner manages members - delete" ON public.company_members
  FOR DELETE TO authenticated USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.companies_add_owner_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (company_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER companies_after_insert_add_owner
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.companies_add_owner_member();

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  email text CHECK (email IS NULL OR char_length(email) <= 255),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 32),
  document text CHECK (document IS NULL OR char_length(document) <= 32),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_customers_company ON public.customers (company_id);

CREATE POLICY "members view company customers" ON public.customers
  FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY "members insert company customers" ON public.customers
  FOR INSERT TO authenticated WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members update company customers" ON public.customers
  FOR UPDATE TO authenticated
  USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "members delete company customers" ON public.customers
  FOR DELETE TO authenticated USING (public.has_company_access(company_id));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER companies_touch_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER customers_touch_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
