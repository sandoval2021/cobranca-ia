-- 20260527090400_rpc_create_customer_admin.sql
-- RPC: cadastro manual de cliente. Não persiste credenciais sensíveis
-- (usuario/senha/MAC/Key NUNCA em texto puro nesta função).
-- SECURITY DEFINER. Multi-tenant via company_members ou super admin.
-- Idempotente (create or replace).

create or replace function public.create_customer_admin(
  p_company_id   uuid,
  p_name         text,
  p_whatsapp_e164 text,
  p_amount_cents integer default null,
  p_due_day      integer default null,
  p_status       text    default 'em_dia',
  p_notes        text    default null,
  p_due_date     date    default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_is_super   boolean := false;
  v_has_access boolean := false;
  v_whatsapp   text;
  v_due_day    integer := p_due_day;
  v_new_id     uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  if p_company_id is null then
    raise exception 'COMPANY_REQUIRED' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'NAME_REQUIRED' using errcode = '22023';
  end if;

  v_whatsapp := regexp_replace(coalesce(p_whatsapp_e164, ''), '\D', '', 'g');
  if v_whatsapp = '' then
    raise exception 'WHATSAPP_REQUIRED' using errcode = '22023';
  end if;

  begin
    execute 'select public.is_super_admin($1)' into v_is_super using v_uid;
  exception when undefined_function then
    v_is_super := false;
  end;

  if not v_is_super then
    select exists (
      select 1 from public.company_members cm
      where cm.company_id = p_company_id
        and cm.user_id = v_uid
    ) into v_has_access;
    if not v_has_access then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
  end if;

  if v_due_day is null and p_due_date is not null then
    v_due_day := extract(day from p_due_date)::int;
  end if;

  insert into public.customers
    (company_id, name, whatsapp_e164, amount_cents, due_day, due_date, status, notes, created_at, updated_at)
  values
    (p_company_id, btrim(p_name), v_whatsapp, p_amount_cents, v_due_day, p_due_date,
     coalesce(nullif(p_status, ''), 'em_dia'), p_notes, now(), now())
  returning id into v_new_id;

  return jsonb_build_object(
    'ok', true,
    'customer_id', v_new_id,
    'company_id', p_company_id,
    'due_date', p_due_date,
    'due_day', v_due_day,
    'status', coalesce(nullif(p_status, ''), 'em_dia')
  );
end;
$$;

revoke all on function public.create_customer_admin(uuid, text, text, integer, integer, text, text, date) from public, anon;
grant execute on function public.create_customer_admin(uuid, text, text, integer, integer, text, text, date) to authenticated;

notify pgrst, 'reload schema';
