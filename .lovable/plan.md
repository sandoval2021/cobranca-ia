
# IA CobraEasy — modo produção

Sair do demo seguro e habilitar atendimento real do cliente final + auditoria/custo, sem mexer em login/Resend/MP/Evolution/PWA.

## 1. SQL proposto (NÃO aplicar ainda — aguardar confirmação)

### Tabela `ai_usage_log`
- `company_id` (uuid, FK lógica)
- `user_id` (uuid, nullable — só preenchido no fluxo do dono)
- `usage_type` (enum: `dono` | `cliente`)
- `model` (text)
- `prompt_tokens`, `completion_tokens`, `total_tokens` (int, nullable)
- `estimated_cost_usd` (numeric(10,6))
- `status` (enum: `sucesso` | `erro`)
- `error_reason` (text, nullable)
- `created_at` (timestamptz)

GRANTs: `service_role` ALL; `authenticated` SELECT (só `has_company_access(company_id)`); sem `anon`.
RLS: dono só lê uso da própria empresa; INSERT só via `service_role` (server-side).

### Tabela `customer_support_tokens`
- `token` (text único, gerado server-side com `gen_random_bytes(32)` → base64url, ~43 chars)
- `company_id` (uuid)
- `customer_id` (uuid, nullable — token pode ser por cliente OU genérico da empresa)
- `expires_at` (timestamptz)
- `is_active` (bool default true)
- `last_used_at` (timestamptz, nullable)
- `created_at` (timestamptz)
- Índice único em `token`, índice em `(company_id, is_active)`

GRANTs: `service_role` ALL; `authenticated` SELECT/INSERT/UPDATE só dentro da própria empresa; sem `anon` (validação do token é server-side via `supabaseAdmin`).
RLS: dono só vê/gera tokens da empresa dele.

### Função utilitária
- `public.has_company_access(_company_id uuid)` — SECURITY DEFINER, checa via `company_users`/estrutura existente do projeto. Reusar função existente se já houver (vou verificar antes).

## 2. Backend (server functions — sem Edge Functions)

- `src/lib/ai-usage.server.ts` — `logAiUsage()` via `supabaseAdmin` (INSERT em `ai_usage_log`), com cálculo de custo estimado por modelo (tabela de preços hardcoded para `gpt-4o-mini`, `gpt-5-nano`, `gpt-5-mini`).
- `src/lib/ai-limits.server.ts` — `checkDailyLimit(companyId)` e `checkMonthlyLimit(companyId)`. Limites default: 200 chamadas/dia, 3000/mês por empresa. Retorna `{ allowed, reason, used, limit }`.
- `src/lib/ai-help.functions.ts` (atualizar):
  - Antes da chamada: `checkDailyLimit`. Se bloqueado → erro amigável "Limite diário de IA atingido".
  - Após chamada OpenAI: capturar `response.usage` real e gravar via `logAiUsage`.
  - Em erro: gravar `status='erro'` + `error_reason` sanitizado.
- `src/lib/ai-customer.functions.ts` (sair do demo):
  - `askCustomerHelp({ token, question })` valida token via `supabaseAdmin` em `customer_support_tokens` (ativo + não expirado).
  - Resolve `company_id` + `customer_id` server-side.
  - Busca **somente** dados do próprio cliente: último vencimento, status, valor, instruções de pagamento da empresa.
  - Injeta contexto mínimo no prompt; nunca envia UUID/JSON/dados de outros clientes.
  - Atualiza `last_used_at`.
  - Loga uso com `usage_type='cliente'`.
  - Em token inválido/expirado: retorna mensagem amigável PT-BR ("Link de atendimento expirou. Solicite um novo ao suporte.").
- `src/lib/customer-tokens.functions.ts` (novo) — `createCustomerToken({ customerId?, ttlDays })` para dono gerar token (usa `requireSupabaseAuth`).

## 3. Frontend

- `src/components/ai/AjudaIaPanel.tsx` — manter; adicionar banner quando `checkDailyLimit` retornar bloqueio ou IA indisponível.
- `src/components/ai/AtendimentoIaPanel.tsx` — remover modo demo, tratar erros amigáveis (token expirado/inválido).
- Nova tela `src/routes/tokens-atendimento.tsx` (dono) — listar/gerar/desativar tokens, copiar link `app.cobraeasy.com.br/atendimento-ia/<token>`.
- Sanitizador `ai-sanitize.ts` já existente: reusar.
- Mobile-first, sem rolagem horizontal, textos curtos PT-BR.

## 4. Custo

- Preço hardcoded por 1k tokens (USD): `gpt-4o-mini` input 0.00015 / output 0.0006; `gpt-5-nano` input 0.00005 / output 0.0004. Default = `gpt-4o-mini` (econômico, conforme pedido).
- `estimated_cost_usd` calculado no momento do INSERT no log.
- Tela futura de relatório de custo lê `ai_usage_log` agregado por empresa/dia.

## 5. Segurança (resumo)

- Nenhuma secret no frontend; `OPENAI_API_KEY` continua server-only.
- `supabaseAdmin` só em `*.server.ts` / `*.functions.ts`.
- RLS em todas as novas tabelas; INSERT em log e validação de token só via service_role.
- Sanitização de saída remove UUID/JSON/stack traces.
- Cliente final nunca recebe dados de outra empresa (filtro por `company_id` resolvido pelo token, não pela URL).

## 6. Não tocar

OTP/login, Resend SMTP, Mercado Pago, Evolution/VPS, PWA/branding CobraEasy.

## 7. Entrega

- SQL mostrado acima — **aguardar SIM** antes de aplicar a migration.
- Após SIM: aplicar migration → implementar server fns → atualizar UI → validar build.
- Build OK/NÃO, SQL aplicado SIM/NÃO, sem PR, sem merge.

**Posso aplicar a migration das duas tabelas (`ai_usage_log` + `customer_support_tokens`) com RLS conforme acima?** Responda **SIM** para prosseguir ou aponte ajustes.
