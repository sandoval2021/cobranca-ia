-- 20260527090200_rpc_list_customers_admin.sql
-- RPC: lista clientes de uma empresa com filtros de status e busca.
-- Retorna jsonb { customers: [...], total: int }.
-- SECURITY DEFINER. Multi-tenant via company_members ou super admin.
-- Idempotente (create or replace).

create or replace function public.list_customers_admin(
  p_company_id uuid,
  p_status     text default null,
  p_search     text default null,
  p_limit      integer default 100,
  p_offset     integer default 0
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_is_super   boolean := false;
  v_has_access boolean := false;
  v_total      bigint;
  v_rows       jsonb;
  v_search     text := nullif(btrim(coalesce(p_search, '')), '');
  v_status     text := nullif(btrim(coalesce(p_status, '')), '');
  v_limit      integer := greatest(1, least(coalesce(p_limit, 100), 500));
  v_offset     integer := greatest(0, coalesce(p_offset, 0));
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  if p_company_id is null then
    raise exception 'COMPANY_REQUIRED' using errcode = '22023';
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

  with filtered as (
    select c.*
    from public.customers c
    where c.company_id = p_company_id
      and (v_status is null or c.status = v_status)
      and (
        v_search is null
        or c.name ilike '%' || v_search || '%'
        or coalesce(c.whatsapp_e164, '') ilike '%' || regexp_replace(v_search, '\D', '', 'g') || '%'
      )
  ),
  page as (
    select * from filtered
    order by coalesce(due_date, make_date(1970, 1, 1)) asc, name asc
    limit v_limit offset v_offset
  )
  select
    (select count(*) from filtered),
    coalesce(jsonb_agg(jsonb_build_object(
      'id',            p.id,
      'company_id',    p.company_id,
      'name',          p.name,
      'whatsapp_e164', p.whatsapp_e164,
      'amount_cents',  p.amount_cents,
      'due_day',       p.due_day,
      'due_date',      p.due_date,
      'status',        p.status,
      'notes',         p.notes,
      'updated_at',    p.updated_at
    ) order by coalesce(p.due_date, make_date(1970,1,1)) asc, p.name asc), '[]'::jsonb)
  into v_total, v_rows
  from page p;

  return jsonb_build_object('customers', v_rows, 'total', v_total);
end;
$$;

revoke all on function public.list_customers_admin(uuid, text, text, integer, integer) from public, anon;
grant execute on function public.list_customers_admin(uuid, text, text, integer, integer) to authenticated;

-- NOTA: se existir overload antigo public.list_customers_admin(uuid) no banco
-- pkghjzbvmifmztqvpdeu, validar manualmente e remover via DROP separado para
-- evitar ambiguidade de resolução. Não removido aqui para não impactar binding
-- ainda em uso.

notify pgrst, 'reload schema';
