# SQL versionado — RPCs e schema do MVP (padrão Supabase)

Espelho de `db/migrations/` no caminho padrão Supabase, apenas para versionamento.

## AVISO

- Aplicar SOMENTE no Supabase correto: `pkghjzbvmifmztqvpdeu`.
- NUNCA aplicar no banco Lovable Cloud `ajeyimujgtukcbadyash` (vazio, não é o backend final).
- Migrations são versionadas, NÃO aplicadas automaticamente. Aplicação manual fora do Lovable:

  ```bash
  supabase link --project-ref pkghjzbvmifmztqvpdeu
  supabase db push
  ```

## Ordem

1. 20260527090000_customers_due_date.sql
2. 20260527090100_rpc_renew_customer_admin.sql
3. 20260527090200_rpc_list_customers_admin.sql
4. 20260527090300_rpc_staging_import_customers_from_rows.sql
5. 20260527090400_rpc_create_customer_admin.sql

Todas idempotentes (`create or replace`, `add column if not exists`).

## Segurança

- Sem service_role / anon key / segredos.
- SECURITY DEFINER + SET search_path = public.
- execute revogado de public/anon, concedido só a authenticated.
- Multi-tenant via company_members / is_super_admin.

## Relação com db/migrations/

`db/migrations/` permanece como cópia documental/backup.
