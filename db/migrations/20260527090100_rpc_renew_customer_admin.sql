-- 20260527090100_rpc_renew_customer_admin.sql
-- RPC: renova cliente atualizando due_date / due_day / status / notes.
-- SECURITY DEFINER. Multi-tenant via company_members ou super admin.
-- Idempotente (create or replace). Não aplica dados.

create or replace function public.renew_customer_admin(
  p_customer_id uuid,
  p_due_date    date,
  p_amount_cents integer default null,
  p_notes        text    default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_company_id uuid;
  v_is_super   boolean := false;
  v_has_access boolean := false;
  v_old_notes  text;
  v_new_notes  text;
  v_due_day    integer;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  select company_id, coalesce(notes, '')
    into v_company_id, v_old_notes
  from public.customers
  where id = p_customer_id;

  if v_company_id is null then
    raise exception 'CUSTOMER_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Super admin (se a função existir no projeto).
  begin
    execute 'select public.is_super_admin($1)' into v_is_super using v_uid;
  exception when undefined_function then
    v_is_super := false;
  end;

  if not v_is_super then
    select exists (
      select 1 from public.company_members cm
      where cm.company_id = v_company_id
        and cm.user_id = v_uid
    ) into v_has_access;

    if not v_has_access then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
  end if;

  v_due_day := extract(day from p_due_date)::int;

  v_new_notes := case
    when p_notes is null or btrim(p_notes) = '' then v_old_notes
    when v_old_notes = '' then p_notes
    else v_old_notes || E'\n' || p_notes
  end;

  update public.customers
     set due_date     = p_due_date,
         due_day      = v_due_day,
         status       = 'em_dia',
         amount_cents = coalesce(p_amount_cents, amount_cents),
         notes        = v_new_notes,
         updated_at   = now()
   where id = p_customer_id;

  return jsonb_build_object(
    'ok', true,
    'customer_id', p_customer_id,
    'due_date', p_due_date,
    'due_day', v_due_day,
    'status', 'em_dia'
  );
end;
$$;

revoke all on function public.renew_customer_admin(uuid, date, integer, text) from public, anon;
grant execute on function public.renew_customer_admin(uuid, date, integer, text) to authenticated;

notify pgrst, 'reload schema';
