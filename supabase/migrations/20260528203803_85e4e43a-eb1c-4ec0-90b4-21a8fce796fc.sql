
-- 1) Colunas de cobrança no cliente
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS amount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_day smallint;

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_due_day_check;
ALTER TABLE public.customers
  ADD CONSTRAINT customers_due_day_check
  CHECK (due_day IS NULL OR (due_day BETWEEN 1 AND 31));

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_amount_cents_check;
ALTER TABLE public.customers
  ADD CONSTRAINT customers_amount_cents_check
  CHECK (amount_cents >= 0);

-- 2) ensure_user_default_company: garante e retorna o UUID da empresa padrão do usuário
CREATE OR REPLACE FUNCTION public.ensure_user_default_company()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_email text;
  v_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  -- 1) já é membro de alguma empresa? devolve a mais antiga
  SELECT cm.company_id INTO v_company_id
  FROM public.company_members cm
  WHERE cm.user_id = v_uid
  ORDER BY cm.created_at ASC NULLS LAST
  LIMIT 1;
  IF v_company_id IS NOT NULL THEN
    RETURN v_company_id;
  END IF;

  -- 2) é dono de alguma? devolve
  SELECT c.id INTO v_company_id
  FROM public.companies c
  WHERE c.owner_id = v_uid
  ORDER BY c.created_at ASC
  LIMIT 1;
  IF v_company_id IS NOT NULL THEN
    INSERT INTO public.company_members (company_id, user_id, role)
    VALUES (v_company_id, v_uid, 'owner')
    ON CONFLICT (company_id, user_id) DO NOTHING;
    RETURN v_company_id;
  END IF;

  -- 3) cria nova empresa
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;
  v_name := COALESCE(NULLIF(split_part(COALESCE(v_email, ''), '@', 1), ''), 'Minha empresa');

  INSERT INTO public.companies (name, owner_id)
  VALUES (v_name, v_uid)
  RETURNING id INTO v_company_id;

  RETURN v_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_default_company() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_user_default_company() TO authenticated;

-- 3) create_customer_admin: cadastra cliente com cobrança
CREATE OR REPLACE FUNCTION public.create_customer_admin(
  p_company_id uuid,
  p_name text,
  p_whatsapp_e164 text,
  p_amount_cents integer DEFAULT 0,
  p_due_day integer DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id_required' USING ERRCODE = '22023';
  END IF;
  IF NOT public.has_company_access(p_company_id) THEN
    RAISE EXCEPTION 'forbidden_company' USING ERRCODE = '42501';
  END IF;
  IF p_name IS NULL OR length(btrim(p_name)) = 0 THEN
    RAISE EXCEPTION 'name_required' USING ERRCODE = '22023';
  END IF;
  IF p_due_day IS NOT NULL AND (p_due_day < 1 OR p_due_day > 31) THEN
    RAISE EXCEPTION 'invalid_due_day' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.customers (
    company_id, name, phone, notes, amount_cents, due_day
  ) VALUES (
    p_company_id,
    btrim(p_name),
    NULLIF(btrim(COALESCE(p_whatsapp_e164, '')), ''),
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    COALESCE(p_amount_cents, 0),
    p_due_day::smallint
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_customer_admin(uuid, text, text, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_customer_admin(uuid, text, text, integer, integer, text) TO authenticated;
