-- =====================================================================
-- H1 — Backend-first /empresas + entitlements + active_company
-- Destino: Supabase Lovable Cloud ajeyimujgtukcbadyash
-- IDEMPOTENTE. Pode ser reaplicada sem efeitos colaterais.
-- NÃO toca: clientes, financeiro, WhatsApp, webhooks, G3A,
--           renewal_tasks, queue-ops, assinaturas, planos (estrutura).
-- NÃO aplicada automaticamente. Aplicar via H1.6 controlada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) companies — arquivamento + bloqueio de escrita ampla pelo browser
-- ---------------------------------------------------------------------
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, DELETE, TRUNCATE ON public.companies FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.companies FROM anon;

-- UPDATE: permitido apenas na coluna "name" para authenticated.
REVOKE UPDATE ON public.companies FROM authenticated;
GRANT  UPDATE (name) ON public.companies TO authenticated;

GRANT ALL ON public.companies TO service_role;

-- Remove qualquer policy permissiva antiga de INSERT
DROP POLICY IF EXISTS "Companies insert by authenticated" ON public.companies;
DROP POLICY IF EXISTS "companies_insert_authenticated"     ON public.companies;
DROP POLICY IF EXISTS "Authenticated can insert companies" ON public.companies;

-- Policy de UPDATE restrita: só dono/admin pode editar (name)
DROP POLICY IF EXISTS "companies_update_name_owner_or_admin" ON public.companies;
CREATE POLICY "companies_update_name_owner_or_admin"
  ON public.companies
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin() OR public.has_company_access(id))
  WITH CHECK (public.is_super_admin() OR public.has_company_access(id));

-- ---------------------------------------------------------------------
-- 2) saas_plan_entitlements
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saas_plan_entitlements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id      uuid NOT NULL REFERENCES public.saas_plans(id) ON DELETE CASCADE,
  feature_key  text NOT NULL,
  enabled      boolean NOT NULL DEFAULT false,
  limit_value  integer,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saas_plan_entitlements_plan_feature_uk UNIQUE (plan_id, feature_key),
  CONSTRAINT saas_plan_entitlements_limit_requires_enabled
    CHECK (NOT (enabled = false AND limit_value IS NOT NULL))
);

GRANT SELECT ON public.saas_plan_entitlements TO authenticated;
GRANT ALL    ON public.saas_plan_entitlements TO service_role;

ALTER TABLE public.saas_plan_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spe_select_authenticated" ON public.saas_plan_entitlements;
CREATE POLICY "spe_select_authenticated"
  ON public.saas_plan_entitlements
  FOR SELECT
  TO authenticated
  USING (true);

-- escrita direta pelo browser: NENHUMA policy. Só service_role grava.

DROP TRIGGER IF EXISTS trg_spe_touch_updated_at ON public.saas_plan_entitlements;
CREATE TRIGGER trg_spe_touch_updated_at
  BEFORE UPDATE ON public.saas_plan_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 3) user_company_preferences
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_company_preferences (
  user_id            uuid PRIMARY KEY,
  active_company_id  uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_company_preferences TO authenticated;
GRANT ALL    ON public.user_company_preferences TO service_role;

ALTER TABLE public.user_company_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ucp_select_own" ON public.user_company_preferences;
CREATE POLICY "ucp_select_own"
  ON public.user_company_preferences
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- escrita direta pelo browser BLOQUEADA: nenhuma policy INSERT/UPDATE/DELETE.
-- Toda escrita passa por set_active_company().

DROP TRIGGER IF EXISTS trg_ucp_touch_updated_at ON public.user_company_preferences;
CREATE TRIGGER trg_ucp_touch_updated_at
  BEFORE UPDATE ON public.user_company_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 4) Seeds de entitlements (idempotente)
--    - DNS sempre false
--    - essencial/profissional: ia=false, limit_value=null
--    - escala: ia=true, limit_value=saas_plans.ai_monthly_limit
-- ---------------------------------------------------------------------
WITH plans AS (
  SELECT id, slug, ai_monthly_limit FROM public.saas_plans
)
INSERT INTO public.saas_plan_entitlements (plan_id, feature_key, enabled, limit_value)
SELECT id, 'dns', false, NULL FROM plans
UNION ALL
SELECT id, 'ia',  false, NULL FROM plans WHERE slug IN ('essencial','profissional')
UNION ALL
SELECT id, 'ia',  true,  ai_monthly_limit FROM plans WHERE slug = 'escala'
ON CONFLICT (plan_id, feature_key) DO UPDATE
  SET enabled     = EXCLUDED.enabled,
      limit_value = EXCLUDED.limit_value,
      updated_at  = now();

-- ---------------------------------------------------------------------
-- 5) Backfill — membership owner ausente (não sobrescreve)
-- ---------------------------------------------------------------------
INSERT INTO public.company_members (company_id, user_id, role)
SELECT c.id, c.owner_id, 'owner'
  FROM public.companies c
 WHERE c.owner_id IS NOT NULL
ON CONFLICT (company_id, user_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 6) RPCs
-- ---------------------------------------------------------------------

-- 6.1 get_active_company()
CREATE OR REPLACE FUNCTION public.get_active_company()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_id  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT active_company_id INTO v_id
    FROM public.user_company_preferences
   WHERE user_id = v_uid;

  IF v_id IS NOT NULL AND NOT public.has_company_access(v_id) THEN
    v_id := NULL;
  END IF;

  IF v_id IS NULL THEN
    SELECT cm.company_id INTO v_id
      FROM public.company_members cm
     WHERE cm.user_id = v_uid
     ORDER BY cm.created_at ASC NULLS LAST
     LIMIT 1;
  END IF;

  RETURN v_id;
END;
$fn$;

-- 6.2 set_active_company(uuid)
CREATE OR REPLACE FUNCTION public.set_active_company(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_required' USING ERRCODE = '22023';
  END IF;
  IF NOT public.has_company_access(p_company_id) THEN
    RAISE EXCEPTION 'forbidden_company' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_company_preferences (user_id, active_company_id)
  VALUES (v_uid, p_company_id)
  ON CONFLICT (user_id) DO UPDATE
    SET active_company_id = EXCLUDED.active_company_id,
        updated_at        = now();
END;
$fn$;

-- 6.3 list_companies_for_user()
CREATE OR REPLACE FUNCTION public.list_companies_for_user()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid  uuid := auth.uid();
  v_rows jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF public.is_super_admin() THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'owner_id', c.owner_id,
      'archived_at', c.archived_at,
      'archived_by', c.archived_by,
      'created_at', c.created_at
    ) ORDER BY c.created_at ASC), '[]'::jsonb)
    INTO v_rows
    FROM public.companies c;
  ELSE
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'owner_id', c.owner_id,
      'archived_at', c.archived_at,
      'archived_by', c.archived_by,
      'created_at', c.created_at
    ) ORDER BY c.created_at ASC), '[]'::jsonb)
    INTO v_rows
    FROM public.companies c
    JOIN public.company_members cm ON cm.company_id = c.id AND cm.user_id = v_uid
    WHERE c.archived_at IS NULL;
  END IF;

  RETURN v_rows;
END;
$fn$;

-- 6.4 create_company_admin(text, uuid) — somente super_admin
CREATE OR REPLACE FUNCTION public.create_company_admin(p_name text, p_owner_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_id  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden_super_admin_only' USING ERRCODE = '42501';
  END IF;
  IF p_name IS NULL OR length(btrim(p_name)) = 0 THEN
    RAISE EXCEPTION 'name_required' USING ERRCODE = '22023';
  END IF;
  IF p_owner_id IS NULL THEN
    RAISE EXCEPTION 'owner_required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.companies (name, owner_id)
  VALUES (btrim(p_name), p_owner_id)
  RETURNING id INTO v_id;

  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (v_id, p_owner_id, 'owner')
  ON CONFLICT (company_id, user_id) DO NOTHING;

  RETURN v_id;
END;
$fn$;

-- 6.5 update_company_admin(uuid, text, uuid)
CREATE OR REPLACE FUNCTION public.update_company_admin(
  p_company_id uuid,
  p_name       text,
  p_owner_id   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_required' USING ERRCODE = '22023';
  END IF;
  IF NOT (public.is_super_admin() OR public.has_company_access(p_company_id)) THEN
    RAISE EXCEPTION 'forbidden_company' USING ERRCODE = '42501';
  END IF;

  -- Mudança de dono: apenas super_admin
  IF p_owner_id IS NOT NULL AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden_super_admin_only' USING ERRCODE = '42501';
  END IF;

  UPDATE public.companies
     SET name       = COALESCE(NULLIF(btrim(p_name), ''), name),
         owner_id   = COALESCE(p_owner_id, owner_id),
         updated_at = now()
   WHERE id = p_company_id;

  IF p_owner_id IS NOT NULL THEN
    INSERT INTO public.company_members (company_id, user_id, role)
    VALUES (p_company_id, p_owner_id, 'owner')
    ON CONFLICT (company_id, user_id) DO NOTHING;
  END IF;
END;
$fn$;

-- 6.6 archive_company_admin(uuid) — somente super_admin
CREATE OR REPLACE FUNCTION public.archive_company_admin(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden_super_admin_only' USING ERRCODE = '42501';
  END IF;
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.companies
     SET archived_at = now(),
         archived_by = v_uid,
         updated_at  = now()
   WHERE id = p_company_id;
END;
$fn$;

-- 6.7 get_company_entitlements(uuid)
CREATE OR REPLACE FUNCTION public.get_company_entitlements(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid     uuid := auth.uid();
  v_plan_id uuid;
  v_rows    jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_required' USING ERRCODE = '22023';
  END IF;
  IF NOT public.has_company_access(p_company_id) THEN
    RAISE EXCEPTION 'forbidden_company' USING ERRCODE = '42501';
  END IF;

  SELECT plan_id INTO v_plan_id
    FROM public.company_subscriptions
   WHERE company_id = p_company_id;

  IF v_plan_id IS NULL THEN
    RETURN jsonb_build_object('plan_id', NULL, 'entitlements', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'feature_key', e.feature_key,
    'enabled',     e.enabled,
    'limit_value', e.limit_value
  ) ORDER BY e.feature_key), '[]'::jsonb)
  INTO v_rows
  FROM public.saas_plan_entitlements e
  WHERE e.plan_id = v_plan_id;

  RETURN jsonb_build_object('plan_id', v_plan_id, 'entitlements', v_rows);
END;
$fn$;

-- ---------------------------------------------------------------------
-- 7) Grants das RPCs — revogar PUBLIC/anon, conceder a authenticated
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_active_company()                            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_active_company(uuid)                        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_companies_for_user()                       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_company_admin(text, uuid)                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_company_admin(uuid, text, uuid)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_company_admin(uuid)                     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_company_entitlements(uuid)                  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_active_company()                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_active_company(uuid)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_companies_for_user()                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_company_admin(text, uuid)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_company_admin(uuid, text, uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_company_admin(uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_entitlements(uuid)               TO authenticated;

-- =====================================================================
-- FIM — Migration H1 (não aplicada automaticamente).
-- =====================================================================
