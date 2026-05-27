-- 20260527090300_rpc_staging_import_customers_from_rows.sql
-- RPC: importação inteligente de clientes a partir de linhas jsonb.
-- Normaliza WhatsApp, deduplica por (company_id, whatsapp_e164),
-- preserva notes/extras, mapeia status corretamente.
-- SECURITY DEFINER. Idempotente (create or replace).

create or replace function public.staging_import_customers_from_rows(
  p_company_id uuid,
  p_rows       jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid              uuid := auth.uid();
  v_is_super         boolean := false;
  v_has_access       boolean := false;
  v_row              jsonb;
  v_name             text;
  v_whatsapp_raw     text;
  v_whatsapp         text;
  v_amount_cents     integer;
  v_due_date         date;
  v_due_day          integer;
  v_status_in        text;
  v_situacao         text;
  v_status           text;
  v_notes            text;
  v_existing_id      uuid;
  v_existing_notes   text;
  v_created          integer := 0;
  v_updated          integer := 0;
  v_skipped          integer := 0;
  v_invalid          integer := 0;
  v_dup_groups       integer := 0;
  v_conflicts        integer := 0;
  v_errors           jsonb := '[]'::jsonb;
  v_seen             jsonb := '{}'::jsonb;
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

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_name         := nullif(btrim(coalesce(v_row->>'name', '')), '');
    v_whatsapp_raw := coalesce(v_row->>'whatsapp_e164', v_row->>'whatsapp', '');
    v_whatsapp     := regexp_replace(v_whatsapp_raw, '\D', '', 'g');
    v_amount_cents := nullif(v_row->>'amount_cents', '')::integer;
    v_due_date     := nullif(v_row->>'due_date', '')::date;
    v_due_day      := case when v_due_date is not null
                          then extract(day from v_due_date)::int
                          else nullif(v_row->>'due_day', '')::integer end;
    v_status_in    := lower(coalesce(v_row->>'status', ''));
    v_situacao     := lower(coalesce(v_row->>'situacao', ''));
    v_notes        := coalesce(v_row->>'notes', '');

    if v_name is null or v_whatsapp = '' then
      v_invalid := v_invalid + 1;
      v_errors := v_errors || jsonb_build_object('row', v_row, 'error', 'INVALID_NAME_OR_WHATSAPP');
      continue;
    end if;

    -- Mapeamento de status:
    --   Ativo + Expirado/Vencido => atrasado
    --   Cancelado                 => cancelado
    --   Inativo                   => suspenso
    --   Ativo + Em dia            => em_dia
    -- NUNCA transformar Expirado em cancelado.
    v_status := case
      when v_status_in in ('cancelado') then 'cancelado'
      when v_status_in in ('inativo') then 'suspenso'
      when v_status_in in ('ativo')
        and (v_situacao like 'expir%' or v_situacao like 'vencid%') then 'atrasado'
      when v_status_in in ('ativo') then 'em_dia'
      when v_situacao like 'expir%' or v_situacao like 'vencid%' then 'atrasado'
      else 'em_dia'
    end;

    -- Dedup intra-payload
    if v_seen ? v_whatsapp then
      v_dup_groups := v_dup_groups + 1;
      v_skipped := v_skipped + 1;
      continue;
    end if;
    v_seen := v_seen || jsonb_build_object(v_whatsapp, true);

    select id, coalesce(notes, '')
      into v_existing_id, v_existing_notes
    from public.customers
    where company_id = p_company_id and whatsapp_e164 = v_whatsapp
    limit 1;

    if v_existing_id is null then
      insert into public.customers
        (company_id, name, whatsapp_e164, amount_cents, due_day, due_date, status, notes, created_at, updated_at)
      values
        (p_company_id, v_name, v_whatsapp, v_amount_cents, v_due_day, v_due_date, v_status, v_notes, now(), now());
      v_created := v_created + 1;
    else
      update public.customers
         set name         = coalesce(v_name, name),
             amount_cents = coalesce(v_amount_cents, amount_cents),
             due_day      = coalesce(v_due_day, due_day),
             due_date     = coalesce(v_due_date, due_date),
             status       = v_status,
             notes        = case
                              when v_notes = '' then v_existing_notes
                              when v_existing_notes = '' then v_notes
                              else v_existing_notes || E'\n' || v_notes
                            end,
             updated_at   = now()
       where id = v_existing_id;
      v_updated := v_updated + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'created_count',          v_created,
    'updated_count',          v_updated,
    'skipped_count',          v_skipped,
    'invalid_count',          v_invalid,
    'duplicate_groups_count', v_dup_groups,
    'conflicts_count',        v_conflicts,
    'errors',                 v_errors
  );
end;
$$;

revoke all on function public.staging_import_customers_from_rows(uuid, jsonb) from public, anon;
grant execute on function public.staging_import_customers_from_rows(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
