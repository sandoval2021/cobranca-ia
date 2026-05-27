# SQL versionado — RPCs e schema do MVP

Estes arquivos versionam o backend usado pelo MVP no Supabase **antigo correto**:

- Projeto alvo: `pkghjzbvmifmztqvpdeu`
- Projeto PROIBIDO: `ajeyimujgtukcbadyash` (banco Lovable Cloud vazio — NÃO usar como backend final)

## Por que `db/migrations/` e não `supabase/migrations/`?

A pasta `supabase/migrations/` neste workspace é gerida pelo Lovable e só aceita
arquivos criados pela ferramenta interna `supabase--migration`, que aplica o SQL
imediatamente no banco Lovable Cloud (`ajeyimujgtukcbadyash`) — exatamente o
banco que **não** é o backend final.

Para preservar o versionamento sem aplicar nada contra o banco errado, o SQL
fica aqui. Quando for executar contra `pkghjzbvmifmztqvpdeu`, use Supabase CLI
fora do Lovable apontando para o projeto certo:

```bash
supabase link --project-ref pkghjzbvmifmztqvpdeu
supabase db push   # ou rode os arquivos manualmente via psql
```

## Ordem de aplicação

1. `20260527090000_customers_due_date.sql`
2. `20260527090100_rpc_renew_customer_admin.sql`
3. `20260527090200_rpc_list_customers_admin.sql`
4. `20260527090300_rpc_staging_import_customers_from_rows.sql`
5. `20260527090400_rpc_create_customer_admin.sql`

Todas as migrations são **idempotentes** (`create or replace function`,
`add column if not exists`) e podem ser reaplicadas sem efeitos colaterais.

## Segurança

- Nenhum arquivo contém `service_role`, anon key ou outro segredo.
- Todas as funções são `SECURITY DEFINER` com `SET search_path = public`.
- `execute` é revogado de `public` e `anon` e concedido apenas a `authenticated`.
- Multi-tenant: toda função valida `auth.uid()` e acesso via `company_members`
  ou super admin (`is_super_admin(uid)` quando existir).
- Credenciais sensíveis (usuário, senha, MAC, key) NÃO são persistidas em texto
  puro por nenhuma destas funções.
