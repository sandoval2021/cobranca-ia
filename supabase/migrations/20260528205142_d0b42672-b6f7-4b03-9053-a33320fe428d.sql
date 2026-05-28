
-- Add missing columns used by list_customers_admin
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'em_dia',
  ADD COLUMN IF NOT EXISTS due_date date;

CREATE INDEX IF NOT EXISTS customers_due_date_idx ON public.customers (due_date);
CREATE INDEX IF NOT EXISTS customers_status_idx ON public.customers (status);

-- RPC: list customers for the clients page
CREATE OR REPLACE FUNCTION public.list_customers_admin(
  p_company_id uuid,
  p_status     text DEFAULT NULL,
  p_search     text DEFAULT NULL,
  p_limit      integer DEFAULT 100,
  p_offset     integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_total    bigint;
  v_rows     jsonb;
  v_search   text := NULLIF(btrim(COALESCE(p_search, '')), '');
  v_status   text := NULLIF(btrim(COALESCE(p_status, '')), '');
  v_limit    integer := GREATEST(1, LEAST(COALESCE(p_limit, 100), 500));
  v_offset   integer := GREATEST(0, COALESCE(p_offset, 0));
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

  WITH filtered AS (
    SELECT c.*
    FROM public.customers c
    WHERE c.company_id = p_company_id
      AND (v_status IS NULL OR c.status = v_status)
      AND (
        v_search IS NULL
        OR c.name ILIKE '%' || v_search || '%'
        OR COALESCE(c.phone, '') ILIKE '%' || regexp_replace(v_search, '\D', '', 'g') || '%'
      )
  ),
  page AS (
    SELECT * FROM filtered
    ORDER BY COALESCE(due_date, make_date(1970,1,1)) ASC, name ASC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT
    (SELECT COUNT(*) FROM filtered),
    COALESCE(jsonb_agg(jsonb_build_object(
      'id',            p.id,
      'company_id',    p.company_id,
      'name',          p.name,
      'whatsapp_e164', p.phone,
      'phone',         p.phone,
      'amount_cents',  p.amount_cents,
      'due_day',       p.due_day,
      'due_date',      p.due_date,
      'status',        p.status,
      'notes',         p.notes,
      'updated_at',    p.updated_at
    ) ORDER BY COALESCE(p.due_date, make_date(1970,1,1)) ASC, p.name ASC), '[]'::jsonb)
  INTO v_total, v_rows
  FROM page p;

  RETURN jsonb_build_object('customers', v_rows, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.list_customers_admin(uuid, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_customers_admin(uuid, text, text, integer, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
