
## O que vai ser construído

IA do WhatsApp deixa de ter preço/planos no prompt fixo e passa a usar dados reais do banco. Dono configura tudo em `/ia-config`. Cliente novo é perguntado sobre indicação; se citar indicador e ele existir, herda o mesmo grupo de preço. Se não achar, encaminha humano. IA também sabe responder dúvidas técnicas dos apps (XCIPTV, IBO, Smarters etc.) com base configurável.

## Modelo de dados (migration única)

Novas tabelas (todas com `company_id`, RLS por `has_company_access`):

- **`price_groups`** — `name`, `description`, `is_default boolean`, `is_active`, `ai_notes text`, `priority int`. Restrição: um `is_default=true` por empresa.
- **`price_group_plans`** — `price_group_id`, `name`, `screens int`, `duration_days int`, `price_cents int`, `allow_installments bool`, `notes`, `is_active`. Substitui preço fixo no prompt.
- **`app_support_kb`** — `app_name` (XCIPTV, IBO, Smarters, Bob, IBO Revenda, Vu, Blink, Unitv, outros), `login_type` (`user_pass` | `mac_key`), `is_paid`, `stability_level`, `how_to_update`, `how_to_change_route`, `common_issues text`, `default_reply text`, `escalate_when text`, `is_active`.
- **`ai_company_settings`** — uma linha por empresa: `support_instructions`, `ask_referral_for_new boolean default true`, `escalate_when_referrer_missing boolean default true`, `human_handoff_number text`.

Alterações em `customers`:
- `price_group_id uuid null` (FK lógica)
- `referral_customer_id uuid null` (quem indicou)
- `referral_raw text null` (texto bruto se indicador não foi resolvido)

Sem mexer em OTP, billing, Mercado Pago, VPS, DNS.

## Motor determinístico antes da OpenAI

Novo `src/lib/whatsapp/ai-context.server.ts`:

1. Normaliza telefone (DDI 55, dígitos).
2. Busca `customer` por telefone na empresa.
3. Detecta intenção por regex/keywords: `price`, `trial`, `support`, `renewal`, `payment`, `referral`, `app_issue`, `other`.
4. Resolve `price_group_id`:
   - cliente existente → seu próprio grupo
   - cliente novo + menciona indicação → tenta achar indicador por nome/telefone citado → herda grupo dele; se não achar → marca `needs_human=true`
   - cliente novo sem menção → IA pergunta "veio por indicação?" (flag `ask_referral`)
5. Carrega só os planos daquele grupo (não envia banco inteiro).
6. Se intenção é `app_issue`, detecta app citado e injeta entrada de `app_support_kb`.
7. Monta prompt enxuto (system curto + contexto JSON pequeno) → `gpt-4o-mini`.

Regras duras (no system prompt):
- nunca inventar preço/plano/desconto
- nunca confirmar pagamento/renovação
- se faltar dado → pedir ou encaminhar humano

Refactor `src/lib/whatsapp/ai-reply.server.ts` para usar esse contexto em vez do prompt atual.

## Painel `/ia-config` (mobile-first)

Nova rota com 4 abas:

1. **Grupos de preço** — listar/criar/editar `price_groups`, marcar padrão, adicionar planos dentro.
2. **Apps suportados** — CRUD de `app_support_kb` com selects (tipo login, estabilidade).
3. **Indicação** — toggles: perguntar indicação para cliente novo, encaminhar humano se indicador não achado, número humano.
4. **Instruções gerais** — `support_instructions` (textarea), preview do que a IA vai usar.

Usa componentes existentes (`Card`, `Input`, `Switch`, `Select`, `Textarea`, `Dialog`). Sem mostrar UUIDs. Tooltips com `?` nos campos sensíveis.

Vincular cliente a grupo de preço: campo `Select` na tela de cliente já existente (`/clientes` edit) — adição pequena, não refaz tela.

## Server functions novas

`src/lib/ia-config/ia-config.functions.ts`:
- `listPriceGroups`, `upsertPriceGroup`, `deletePriceGroup`
- `listPlans(groupId)`, `upsertPlan`, `deletePlan`
- `listApps`, `upsertApp`, `deleteApp`
- `getAiSettings`, `updateAiSettings`

Todas com `requireSupabaseAuth` + validação Zod.

## Validação (cenários do brief)

Após build, simulação server-to-server cobrindo:
- "valor" sem contexto → grupo padrão
- cliente R$12 pergunta valor → tabela R$12
- "vim indicado pelo 82999..." com indicador existente → herda grupo
- "vim indicado por João" sem achar → pede número; se ainda não achar → handoff
- "meu IBO travou" → resposta do KB do IBO
- "paguei" → pede comprovante, não confirma

## Arquivos

Novos:
- `db/migrations/20260528120000_price_groups_apps_referral.sql`
- `src/lib/ia-config/ia-config.functions.ts`
- `src/lib/whatsapp/ai-context.server.ts`
- `src/lib/whatsapp/intent.ts`
- `src/routes/ia-config.tsx` + subcomponentes em `src/components/ia-config/`

Alterados:
- `src/lib/whatsapp/ai-reply.server.ts` (usa novo contexto)
- `src/components/clientes/...` (campo grupo de preço — edição mínima)
- `src/components/layout/AppSidebar.tsx` (link novo)

Não tocar:
- OTP/login, Resend, Mercado Pago, VPS, DNS, QR WhatsApp, `client.ts`, `types.ts`

## Entrega final
- Build OK/NÃO
- SQL aplicado: SIM (migration nova)
- PR: NÃO / MERGE: NÃO
- Cenários testados em simulação
- Custo estimado por atendimento (gpt-4o-mini com prompt enxuto: ~$0.0003–0.0008 por resposta)
