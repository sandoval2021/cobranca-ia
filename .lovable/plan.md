
## Diagnóstico

Já estão no banco (corretos):
- **Clientes** → tabela `customers` (via RPC `list_customers_admin`, `create_customer_admin`, `update_customer_admin`, etc.)
- **Servidores** → tabela `servers` (migrado na tarefa anterior, com cache local sincronizado)
- **Apps pagos (catálogo do dono)** → tabela `portal_apps`
- **DNS / domínios** → `dns_domains`, `dns_routes`

Ainda em **localStorage** (PROBLEMA — somem entre dispositivos):

| Arquivo | O que guarda | Tabela alvo no banco |
|---|---|---|
| `src/lib/app-screens.ts` | Telas do cliente: MAC, KEY, usuário, senha, vencimento, servidor vinculado, app usado, valor, observações | `customer_iptv_credentials` + `customer_portal_devices` |
| `src/lib/customer-extras.ts` | E-mail e aniversário do cliente | adicionar colunas em `customers` (já existe `email`) |
| `src/lib/customer-plans.ts` | Snapshot do plano por cliente | usar `price_group_plans` + `customers.price_group_id` (já existem) |
| `src/lib/customer-due-override.ts` | Override de data de vencimento | já tem `customers.due_date` — só remover override local |
| `src/lib/manual-renewals.ts` | Histórico de renovações manuais | **nova tabela** `customer_renewal_history` |
| `src/lib/services-catalog.ts` | Catálogo de serviços do dono | **nova tabela** `services_catalog` |

Consumidores principais:
- `src/components/clientes/AppScreensSection.tsx` (1079 linhas) — usa `listScreens`/`upsertScreen` síncrono
- `src/routes/clientes.tsx` (3491 linhas) — usa todos os módulos acima de forma síncrona
- Várias rotas (pendencias, operacao-dia, gestao-servicos, campanhas-manuais) leem `listAllScreens()`

## Estratégia (mesmo padrão do `server-catalog`)

1. Banco = fonte da verdade. Cache local = apenas performance (hidratado do banco).
2. Manter a **API síncrona atual** (`listScreens`, `upsertScreen`, etc.) — por baixo, todo write dispara fire-and-forget para o banco e todo mount executa hydrate.
3. Nunca sobrescrever banco com cache vazio. Flag `__loaded` antes de qualquer write destrutivo.
4. Banner de migração: se cache local tem dados e banco está vazio, "Enviar para minha conta".

## Mudanças por fase

### Fase 1 — Telas (CRÍTICO, maior valor)
- **Novo:** `src/lib/screens/screens.functions.ts` — server functions com `requireSupabaseAuth`:
  - `listScreensDb(companyId)` → join `customer_iptv_credentials` + `customer_portal_devices` + `portal_apps`
  - `upsertScreenDb(screen)` → grava credencial IPTV (servidor, user/pass, expires_at, mac, key, app_used) e device de portal
  - `archiveScreenDb`, `reactivateScreenDb`, `deleteScreenDb`
  - Senha/key criptografadas com `encryptSecret` (mesmo `CREDENTIALS_ENC_KEY` já usado em `servers`)
- **Novo:** `src/lib/screens/useScreensSync.ts` — hydrate no mount/focus/troca de empresa, intervalo de 5min
- **Editar:** `src/lib/app-screens.ts` — adicionar `hydrateFromDb`, flag `__loaded`, manter API síncrona
- **Editar:** `src/routes/__root.tsx` (AppShell) — montar `useScreensSync()`
- **Editar:** `AppScreensSection.tsx` — adicionar estado de loading/sync, banner "Enviar para a nuvem" se houver dados locais não migrados

### Fase 2 — Renovações + Serviços
- **Migration SQL:** criar `services_catalog` e `customer_renewal_history` com RLS por `has_company_access(company_id)` + GRANTs
- **Novo:** `src/lib/services/services.functions.ts`, `src/lib/renewals/renewals.functions.ts` + hooks de sync
- **Editar:** `services-catalog.ts`, `manual-renewals.ts` no mesmo padrão de cache+DB

### Fase 3 — Extras e overrides
- Mover `customer-extras.ts` (email/aniversário) para colunas em `customers` (email já existe; adicionar `birth_date`)
- Remover `customer-due-override.ts` — passar a usar `customers.due_date` direto via `update_customer_admin`

### Fase 4 — IA Atendente
- Atualizar prompts/contexto da IA para consultar via server functions do banco:
  - cliente + telas + credenciais + servidor + app + expiração — tudo via `list_customers_admin` + `listScreensDb` por `customer_id`
- Garantir zero leitura de localStorage no caminho da IA

## SQL aplicado

- **Fase 1:** NÃO (tabelas `customer_iptv_credentials`, `customer_portal_devices`, `portal_apps` já existem)
- **Fase 2:** SIM (criar `services_catalog`, `customer_renewal_history`)
- **Fase 3:** SIM (adicionar `birth_date` em `customers`)

## Risco

- 17+ arquivos consomem `listScreens()` síncrono. Primeiro render após login mostra cache vazio por ~200ms até hydrate responder. Mitigação: cache de sessão preenche imediatamente, hydrate só substitui após.
- **Sem perda de dados:** banner "Enviar para a nuvem" preserva localStorage até migração explícita.

## Escopo desta execução

Como esta é uma refatoração muito grande (5 módulos + 2 telas gigantes), proponho executar **apenas a Fase 1 (Telas)** nesta mesma tarefa — é o maior valor e o que o usuário descreveu primeiro (MAC, KEY, usuário, senha, expiração, servidor vinculado). Fases 2-4 ficam para tarefas subsequentes, evitando quebrar `clientes.tsx` (3491 linhas) em um único PR mental.

Confirma a execução só da Fase 1 agora?
