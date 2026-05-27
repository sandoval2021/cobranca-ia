-- 20260528090000_billing_mercado_pago_phase1.sql
-- Fase 1 Mercado Pago — estrutura de planos, assinaturas, tentativas e webhooks.
-- NÃO aplica automaticamente. Aplicar manualmente em pkghjzbvmifmztqvpdeu via:
--   supabase link --project-ref pkghjzbvmifmztqvpdeu
--   psql "$SUPABASE_DB_URL" -f db/migrations/20260528090000_billing_mercado_pago_phase1.sql
--
-- Não armazena dados de cartão (PAN, CVV, token de cartão).
-- raw_payload deve ser higienizado pela camada server-side antes da insert.

-- =========================================================
-- 1. billing_plans
-- =========================================================
create table if not exists public.billing_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  currency text not null default 'BRL',
  trial_days integer not null default 0 check (trial_days >= 0),
  active boolean not null default true,
  features jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.billing_plans to anon, authenticated;
grant all on public.billing_plans to service_role;

alter table public.billing_plans enable row level security;

drop policy if exists "billing_plans select all" on public.billing_plans;
create policy "billing_plans select all"
  on public.billing_plans for select
  using (true);

drop policy if exists "billing_plans super admin write" on public.billing_plans;
create policy "billing_plans super admin write"
  on public.billing_plans for all
  using (public.current_user_is_super_admin())
  with check (public.current_user_is_super_admin());

-- =========================================================
-- 2. owner_subscriptions
-- =========================================================
create table if not exists public.owner_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  plan_id uuid references public.billing_plans(id),
  status text not null default 'trialing',
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  payment_provider text default 'mercado_pago',
  provider_customer_id text,
  provider_subscription_id text,
  provider_status text,
  accepted_terms_version text,
  accepted_terms_at timestamptz,
  accepted_terms_snapshot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists owner_subscriptions_company_idx on public.owner_subscriptions(company_id);

grant select, insert, update on public.owner_subscriptions to authenticated;
grant all on public.owner_subscriptions to service_role;

alter table public.owner_subscriptions enable row level security;

drop policy if exists "owner_subscriptions self read" on public.owner_subscriptions;
create policy "owner_subscriptions self read"
  on public.owner_subscriptions for select
  using (
    public.current_user_is_super_admin()
    or exists (
      select 1 from public.company_members cm
      where cm.company_id = owner_subscriptions.company_id
        and cm.user_id = auth.uid()
    )
  );

drop policy if exists "owner_subscriptions super admin write" on public.owner_subscriptions;
create policy "owner_subscriptions super admin write"
  on public.owner_subscriptions for all
  using (public.current_user_is_super_admin())
  with check (public.current_user_is_super_admin());

-- =========================================================
-- 3. payment_attempts
-- =========================================================
create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  subscription_id uuid references public.owner_subscriptions(id),
  provider text not null default 'mercado_pago',
  provider_payment_id text,
  provider_preference_id text,
  method text,
  status text not null default 'created',
  amount_cents integer not null default 0,
  currency text not null default 'BRL',
  checkout_url text,
  pix_qr_code text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_attempts_company_idx on public.payment_attempts(company_id);
create index if not exists payment_attempts_subscription_idx on public.payment_attempts(subscription_id);

grant select on public.payment_attempts to authenticated;
grant all on public.payment_attempts to service_role;

alter table public.payment_attempts enable row level security;

drop policy if exists "payment_attempts self read" on public.payment_attempts;
create policy "payment_attempts self read"
  on public.payment_attempts for select
  using (
    public.current_user_is_super_admin()
    or exists (
      select 1 from public.company_members cm
      where cm.company_id = payment_attempts.company_id
        and cm.user_id = auth.uid()
    )
  );

-- escrita só via service_role (server-side); sem policy para authenticated.

-- =========================================================
-- 4. payment_webhook_events
-- =========================================================
create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'mercado_pago',
  event_type text,
  provider_event_id text,
  resource_id text,
  processed boolean not null default false,
  raw_payload jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text
);

create unique index if not exists payment_webhook_events_provider_event_idx
  on public.payment_webhook_events(provider, provider_event_id)
  where provider_event_id is not null;

grant all on public.payment_webhook_events to service_role;

alter table public.payment_webhook_events enable row level security;

drop policy if exists "payment_webhook_events super admin read" on public.payment_webhook_events;
create policy "payment_webhook_events super admin read"
  on public.payment_webhook_events for select
  using (public.current_user_is_super_admin());

-- =========================================================
-- 5. terms_acceptances
-- =========================================================
create table if not exists public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  user_id uuid not null,
  terms_version text not null,
  terms_snapshot text not null,
  accepted_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  payment_method_context text,
  created_at timestamptz not null default now()
);

create index if not exists terms_acceptances_company_idx on public.terms_acceptances(company_id);
create index if not exists terms_acceptances_user_idx on public.terms_acceptances(user_id);

grant select, insert on public.terms_acceptances to authenticated;
grant all on public.terms_acceptances to service_role;

alter table public.terms_acceptances enable row level security;

drop policy if exists "terms_acceptances self read" on public.terms_acceptances;
create policy "terms_acceptances self read"
  on public.terms_acceptances for select
  using (
    public.current_user_is_super_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.company_members cm
      where cm.company_id = terms_acceptances.company_id
        and cm.user_id = auth.uid()
    )
  );

drop policy if exists "terms_acceptances self insert" on public.terms_acceptances;
create policy "terms_acceptances self insert"
  on public.terms_acceptances for insert
  with check (user_id = auth.uid());

notify pgrst, 'reload schema';
