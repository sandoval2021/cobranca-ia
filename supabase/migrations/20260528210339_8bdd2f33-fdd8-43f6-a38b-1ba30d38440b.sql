
-- get_customer_details_admin: retorna a linha completa do cliente como jsonb
CREATE OR REPLACE FUNCTION public.get_customer_details_admin(p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.customers;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO v_row FROM public.customers WHERE id = p_customer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.has_company_access(v_row.company_id) THEN
    RAISE EXCEPTION 'forbidden_company' USING ERRCODE = '42501';
  END IF;
  RETURN to_jsonb(v_row) || jsonb_build_object('whatsapp_e164', v_row.phone);
END;
$$;

REVOKE ALL ON FUNCTION public.get_customer_details_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_details_admin(uuid) TO authenticated;

-- update_customer_admin
CREATE OR REPLACE FUNCTION public.update_customer_admin(
  p_customer_id uuid,
  p_name text DEFAULT NULL,
  p_whatsapp_e164 text DEFAULT NULL,
  p_amount_cents integer DEFAULT NULL,
  p_due_day integer DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_company uuid;
  v_row public.customers;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  SELECT company_id INTO v_company FROM public.customers WHERE id = p_customer_id;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.has_company_access(v_company) THEN
    RAISE EXCEPTION 'forbidden_company' USING ERRCODE = '42501';
  END IF;
  IF p_due_day IS NOT NULL AND (p_due_day < 1 OR p_due_day > 31) THEN
    RAISE EXCEPTION 'invalid_due_day' USING ERRCODE = '22023';
  END IF;

  UPDATE public.customers SET
    name         = COALESCE(NULLIF(btrim(p_name), ''), name),
    phone        = COALESCE(NULLIF(btrim(p_whatsapp_e164), ''), phone),
    amount_cents = COALESCE(p_amount_cents, amount_cents),
    due_day      = COALESCE(p_due_day::smallint, due_day),
    status       = COALESCE(NULLIF(btrim(p_status), ''), status),
    notes        = COALESCE(p_notes, notes),
    updated_at   = now()
  WHERE id = p_customer_id
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row) || jsonb_build_object('whatsapp_e164', v_row.phone);
END;
$$;

REVOKE ALL ON FUNCTION public.update_customer_admin(uuid, text, text, integer, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_customer_admin(uuid, text, text, integer, integer, text, text) TO authenticated;

-- archive_customer_admin
CREATE OR REPLACE FUNCTION public.archive_customer_admin(p_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  SELECT company_id INTO v_company FROM public.customers WHERE id = p_customer_id;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.has_company_access(v_company) THEN
    RAISE EXCEPTION 'forbidden_company' USING ERRCODE = '42501';
  END IF;
  UPDATE public.customers
     SET status = 'arquivado', updated_at = now()
   WHERE id = p_customer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_customer_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_customer_admin(uuid) TO authenticated;

-- reactivate_customer_admin
CREATE OR REPLACE FUNCTION public.reactivate_customer_admin(p_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  SELECT company_id INTO v_company FROM public.customers WHERE id = p_customer_id;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.has_company_access(v_company) THEN
    RAISE EXCEPTION 'forbidden_company' USING ERRCODE = '42501';
  END IF;
  UPDATE public.customers
     SET status = 'em_dia', updated_at = now()
   WHERE id = p_customer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reactivate_customer_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reactivate_customer_admin(uuid) TO authenticated;

-- renew_customer_admin: aplica nova data de vencimento e devolve a linha
CREATE OR REPLACE FUNCTION public.renew_customer_admin(
  p_customer_id uuid,
  p_due_date date,
  p_amount_cents integer DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
  v_row public.customers;
  v_history text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  SELECT company_id INTO v_company FROM public.customers WHERE id = p_customer_id;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.has_company_access(v_company) THEN
    RAISE EXCEPTION 'forbidden_company' USING ERRCODE = '42501';
  END IF;
  IF p_due_date IS NULL THEN
    RAISE EXCEPTION 'due_date_required' USING ERRCODE = '22023';
  END IF;

  v_history := COALESCE(p_notes, '');

  UPDATE public.customers SET
    due_date     = p_due_date,
    due_day      = EXTRACT(DAY FROM p_due_date)::smallint,
    amount_cents = COALESCE(p_amount_cents, amount_cents),
    status       = 'em_dia',
    notes        = CASE
                     WHEN v_history = '' THEN notes
                     WHEN notes IS NULL OR btrim(notes) = '' THEN v_history
                     ELSE notes || E'\n\n' || v_history
                   END,
    updated_at   = now()
  WHERE id = p_customer_id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'due_date', v_row.due_date,
    'due_day',  v_row.due_day,
    'status',   v_row.status,
    'amount_cents', v_row.amount_cents
  );
END;
$$;

REVOKE ALL ON FUNCTION public.renew_customer_admin(uuid, date, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renew_customer_admin(uuid, date, integer, text) TO authenticated;
