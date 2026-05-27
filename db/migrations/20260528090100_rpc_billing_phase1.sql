-- 20260528090100_rpc_billing_phase1.sql
-- RPCs Mercado Pago Fase 1. NÃO aplica automaticamente.
-- Depende de: billing_plans, owner_subscriptions, payment_attempts, terms_acceptances,
-- company_members, current_user_is_super_admin().

-- 1) get_owner_billing_status(company uuid)
create or replace function public.get_owner_billing_status(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_allowed boolean;
  v_sub public.owner_subscriptions;
  v_plan public.billing_plans;
  v_last_attempt public.payment_attempts;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select public.current_user_is_super_admin()
      or exists (select 1 from public.company_members cm
                 where cm.company_id = p_company_id and cm.user_id = auth.uid())
    into v_allowed;

  if not v_allowed then
    raise exception 'forbidden';
  end if;

  select * into v_sub
    from public.owner_subscriptions
    where company_id = p_company_id
    order by created_at desc
    limit 1;

  if v_sub.plan_id is not null then
    select * into v_plan from public.billing_plans where id = v_sub.plan_id;
  end if;

  select * into v_last_attempt
    from public.payment_attempts
    where company_id = p_company_id
    order by created_at desc
    limit 1;

  return jsonb_build_object(
    'subscription', to_jsonb(v_sub),
    'plan',         to_jsonb(v_plan),
    'last_attempt', to_jsonb(v_last_attempt)
  );
end;
$$;

revoke execute on function public.get_owner_billing_status(uuid) from public, anon;
grant execute on function public.get_owner_billing_status(uuid) to authenticated;

-- 2) accept_payment_terms
create or replace function public.accept_payment_terms(
  p_company_id uuid,
  p_terms_version text,
  p_terms_snapshot text,
  p_payment_method_context text default null,
  p_ip_address text default null,
  p_user_agent text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_allowed boolean;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select exists (select 1 from public.company_members cm
                 where cm.company_id = p_company_id and cm.user_id = auth.uid())
    into v_allowed;

  if not v_allowed and not public.current_user_is_super_admin() then
    raise exception 'forbidden';
  end if;

  insert into public.terms_acceptances (
    company_id, user_id, terms_version, terms_snapshot,
    payment_method_context, ip_address, user_agent
  ) values (
    p_company_id, auth.uid(), p_terms_version, p_terms_snapshot,
    p_payment_method_context, p_ip_address, p_user_agent
  ) returning id into v_id;

  update public.owner_subscriptions
    set accepted_terms_version = p_terms_version,
        accepted_terms_at = now(),
        accepted_terms_snapshot = p_terms_snapshot,
        updated_at = now()
    where company_id = p_company_id;

  return v_id;
end;
$$;

revoke execute on function public.accept_payment_terms(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.accept_payment_terms(uuid, text, text, text, text, text) to authenticated;

-- 3) admin_list_billing_plans
create or replace function public.admin_list_billing_plans()
returns setof public.billing_plans
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.current_user_is_super_admin() then
    raise exception 'forbidden';
  end if;
  return query select * from public.billing_plans order by amount_cents asc, name asc;
end;
$$;

revoke execute on function public.admin_list_billing_plans() from public, anon;
grant execute on function public.admin_list_billing_plans() to authenticated;

-- 4) admin_upsert_billing_plan
create or replace function public.admin_upsert_billing_plan(
  p_id uuid,
  p_name text,
  p_description text,
  p_amount_cents integer,
  p_currency text,
  p_trial_days integer,
  p_active boolean,
  p_features jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.current_user_is_super_admin() then
    raise exception 'forbidden';
  end if;

  if p_id is null then
    insert into public.billing_plans (name, description, amount_cents, currency, trial_days, active, features)
      values (p_name, p_description, coalesce(p_amount_cents,0), coalesce(p_currency,'BRL'),
              coalesce(p_trial_days,0), coalesce(p_active,true), coalesce(p_features,'[]'::jsonb))
      returning id into v_id;
  else
    update public.billing_plans set
      name = p_name,
      description = p_description,
      amount_cents = coalesce(p_amount_cents, amount_cents),
      currency = coalesce(p_currency, currency),
      trial_days = coalesce(p_trial_days, trial_days),
      active = coalesce(p_active, active),
      features = coalesce(p_features, features),
      updated_at = now()
    where id = p_id
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.admin_upsert_billing_plan(uuid, text, text, integer, text, integer, boolean, jsonb) from public, anon;
grant execute on function public.admin_upsert_billing_plan(uuid, text, text, integer, text, integer, boolean, jsonb) to authenticated;

-- 5) admin_set_company_subscription_status
create or replace function public.admin_set_company_subscription_status(
  p_company_id uuid,
  p_status text,
  p_current_period_end timestamptz default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_is_super_admin() then
    raise exception 'forbidden';
  end if;

  update public.owner_subscriptions
    set status = p_status,
        current_period_end = coalesce(p_current_period_end, current_period_end),
        updated_at = now()
    where company_id = p_company_id;
end;
$$;

revoke execute on function public.admin_set_company_subscription_status(uuid, text, timestamptz) from public, anon;
grant execute on function public.admin_set_company_subscription_status(uuid, text, timestamptz) to authenticated;

notify pgrst, 'reload schema';
