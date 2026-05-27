-- 20260527090000_customers_due_date.sql
-- Garante a coluna customers.due_date sem remover due_day nem qualquer outro campo.
-- Idempotente. Não modifica dados.

alter table public.customers
  add column if not exists due_date date;

create index if not exists customers_due_date_idx
  on public.customers (due_date);

notify pgrst, 'reload schema';
