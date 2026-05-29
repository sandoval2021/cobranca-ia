# Fase 3 — Eliminar dados presos em aparelho

## Escopo

### Bloco A — Novas tabelas (migration única)

7 tabelas novas no `public`, todas com:
- `id uuid pk`, `company_id uuid not null`, `created_at`, `updated_at` + trigger `touch_updated_at`
- `GRANT SELECT/INSERT/UPDATE/DELETE` em `authenticated` + `GRANT ALL` em `service_role`
- RLS `using/with check (has_company_access(company_id))`
- `ALTER PUBLICATION supabase_realtime ADD TABLE …` para realtime
- `REPLICA IDENTITY FULL` para eventos `UPDATE`/`DELETE` virem com row completa

Tabelas:
1. `trial_leads` — espelha `TrialLead` (nome, whatsapp, origem, status, datas, app, servidor, usuário, senha, valor_cents, horas_teste, interesse, notas)
2. `trial_followups` — `lead_id` (fk → trial_leads on delete cascade), `company_id`, tipo, data_planejada, status, atualizado_em
3. `finance_entries` — campos atuais de `FinanceEntry`
4. `finance_goals` — campos atuais de `FinanceGoal`
5. `customer_extras` — `(company_id, customer_id)` unique, email, birthday, due_date
6. `auto_templates` — `(company_id, template_id)` unique, channels, body, ativo, time_window
7. `revenda_settings` — `company_id` unique, jsonb com config inteira

### Bloco B — Camada de acesso (server functions)

Para cada tabela, em `src/lib/<modulo>/<modulo>.functions.ts`:
- `list…Db({ companyId })` — SELECT escopado
- `upsert…Db({ companyId, item })` — INSERT … ON CONFLICT DO UPDATE
- `bulkUpsert…Db({ companyId, items })` — usado pela auto-migração
- `delete…Db({ companyId, id })` — DELETE escopado

Todas com `.middleware([requireSupabaseAuth])`, validação Zod, leitura via `supabaseAdmin` + verificação `has_company_access` no SQL (RLS é backstop).

### Bloco C — Hook genérico de sync (DB-first silencioso)

Refatorar o padrão atual (que ainda mostra "salvo neste aparelho") em `src/lib/sync/useDbFirstSync.ts`:
- No mount: chama `list…Db`, hidrata cache local com payload do DB (substituindo, não mesclando — DB é fonte da verdade).
- Detecta legado local com `company_id == oldId || company_id == null` ou registros locais não presentes no DB → faz `bulkUpsertDb` automaticamente e silenciosamente, sem banner, sem botão.
- Após upload, marca como sincronizado e remove do cache "pending".
- Nunca apaga cache se DB retornar vazio na primeira tentativa (failsafe offline).
- Expõe apenas `{ loaded, error }` — sem `pendingLocal` na UI.

### Bloco D — Realtime wrapper

`src/hooks/useRealtimeTable.ts`:
```ts
useRealtimeTable({
  table: 'trial_leads',
  companyId,
  onChange: () => queryClient.invalidateQueries(['trial_leads', companyId]),
})
```
- Cria channel único por (table, companyId), filtra `postgres_changes` por `company_id=eq.${companyId}`.
- Unsubscribe no cleanup.
- Reusa channel se montado em N componentes simultâneos (cache global por chave).

Aplicar em: customers, service_plans, screens, servers, trial_leads, finance_entries, customer_extras, auto_templates, revenda_settings.

### Bloco E — Refatorar módulos

Para cada um dos 7 módulos, substituir leitura local pela query DB + hook acima:
- `src/lib/trial-leads.ts` — listTrialLeads/save/delete viram thin wrappers que escrevem DB e atualizam cache.
- `src/lib/financeiro-local.ts` — idem para entries/goals.
- `src/lib/customer-extras.ts` — idem.
- `src/lib/auto-templates.ts` — idem.
- `src/lib/revenda-settings.ts` — idem.

### Bloco F — Remover banners + botões legados

Buscar e remover toda UI que mostra "Encontramos planos salvos apenas neste aparelho", "Enviar para minha conta", e equivalentes nos módulos acima. A auto-migração do Bloco C torna isso obsoleto.

## Risco e tamanho

- **Migration**: 7 tabelas + RLS + publication + replica identity = ~250 linhas SQL.
- **Server functions**: ~7 × 80 linhas = ~560 linhas.
- **Hooks**: useDbFirstSync + useRealtimeTable = ~250 linhas.
- **Refatoração dos módulos**: ~7 × 100 linhas modificadas.
- **Remoção banners**: varia.
- **Total estimado**: ~30 arquivos novos/alterados, ~2.000 linhas.

## Confirmações necessárias antes de executar

1. **OK aplicar a migration completa** (7 tabelas + RLS + realtime + publication)? Não é destrutiva — só CREATE TABLE.
2. **Auto-migração de leads/financeiro existentes**: se o usuário tem leads locais com `company_id` válido (UUID), faço upload silencioso na primeira carga. OK?
3. **`customer_extras`**: hoje a chave é `customer_id` global (sem company_id). Posso resolver `company_id` via JOIN com `customers` durante a migração? OK que extras de clientes deletados sejam descartados?
4. **`revenda_settings`**: hoje é singleton por instalação (sem company_id). Vou tratar como **por empresa** (cada empresa tem suas próprias configs de revenda). Confirma?
5. **Modo de execução**: prefere que eu (a) entregue tudo em um turno gigante, ou (b) divida em 3 PRs lógicos — primeiro migration+server-functions, depois hook+realtime, depois remoção dos banners — validando entre cada um?

Responde 1-5 que eu sigo direto.