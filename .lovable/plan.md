# Treinar minha IA — Plano de Implementação

## Visão geral

Nova rota `/treinar-ia` no painel da empresa, com 6 abas (Conhecimento, FAQs, Regras, Pagamento, Aplicativos, Testar). Tudo isolado por `company_id` via RLS. O motor de contexto da IA do WhatsApp passa a carregar essa base privada antes de chamar OpenAI, sem violar regras globais do CobraEasy.

Sem PR, sem merge.

## Arquitetura em 3 camadas

1. **Global CobraEasy** (já existe em `src/lib/whatsapp/ai-context.server.ts` → `buildPromptFromContext`): regras duras, anti-invenção, handoff. Não editável pelo dono.
2. **Base da empresa** (novo): conhecimento, FAQs, regras, pagamento, apps — tudo com `company_id`.
3. **Dados reais do sistema** (já existe): cliente, plano, grupo, Mercado Pago, indicação.

## Banco — 4 tabelas novas

Todas com `company_id uuid not null`, RLS via `has_company_access(company_id)`, GRANTs para `authenticated` e `service_role` (sem `anon`).

```
company_ai_knowledge        (1 linha por empresa — upsert por company_id)
  knowledge_text text, tone text, answer_length text,
  allow_after_hours, accepts_audio, auto_offer_trial,
  human_on_complaint, human_when_unsure, allow_paid_apps_info,
  use_manual_pix_fallback (booleans)

company_ai_faqs             (várias por empresa)
  category text, question text, answer text, is_active bool

company_ai_payment_settings (1 por empresa)
  manual_pix_key, manual_pix_holder, manual_pix_bank, payment_note

company_ai_app_guides       (várias por empresa)
  app_name, is_paid, app_price_cents, login_type,
  install_steps, update_steps, cache_steps, route_steps,
  common_issues, default_reply, is_active
```

## Server functions

Novo arquivo `src/lib/ai-training/ai-training.functions.ts` com:

- `getCompanyAiKnowledge`, `upsertCompanyAiKnowledge`
- `listCompanyAiFaqs`, `upsertCompanyAiFaq`, `deleteCompanyAiFaq`
- `getCompanyAiPaymentSettings`, `upsertCompanyAiPaymentSettings`
- `listCompanyAiApps`, `upsertCompanyAiApp`, `deleteCompanyAiApp`
- `simulateAiReply` — não envia WhatsApp; usa o mesmo `buildAiContext` + `buildPromptFromContext` e retorna `{ reply, sources[] }` (de onde vieram os dados).

Todas com `requireSupabaseAuth` + `has_company_access` checado server-side.

## Limites por plano (UI)

- Essencial: aba escondida ou knowledge_text ≤ 2.000
- Profissional: ≤ 20.000
- Escala: ≤ 200.000

Contador de caracteres no editor.

## Nova tela `/treinar-ia`

Arquivo `src/routes/treinar-ia.tsx`. Mobile-first, tabs no topo. Cada aba é um componente em `src/components/ai-training/`:

- `KnowledgeTab.tsx` — textarea grande, placeholder com exemplo R$30/60/90, contador, botões salvar/limpar/restaurar exemplo.
- `FaqsTab.tsx` — lista de cards (pergunta/resposta/categoria/ativo), dialog de edição, exclusão com confirm.
- `RulesTab.tsx` — selects (tom, tamanho) + switches com HelpTip (?).
- `PaymentTab.tsx` — campos Pix manual + status do Mercado Pago (lê `marketplace_accounts`) + link para `/pagamentos/mercado-pago`.
- `AppsTab.tsx` — lista de apps, dialog completo, sugestões pré-preenchidas (Bob, IBO, VU, Smarters etc.).
- `TestTab.tsx` — input + chips de exemplos rápidos, mostra resposta + badges das fontes usadas. Banner: "Simulação. Nada foi enviado."

Adicionar entrada no menu (`src/lib/nav.ts` ou onde estiver definido) com label "Treinar IA".

## Integração no motor de IA do WhatsApp

Editar `src/lib/whatsapp/ai-context.server.ts`:

1. `buildAiContext` carrega adicionalmente: knowledge, faqs ativos, payment_settings, apps da empresa.
2. `buildPromptFromContext` inclui esses blocos no `compact` JSON quando relevantes à intenção, e adiciona regras:
   - "Prefira respostas do bloco `faqs_empresa` quando a pergunta casar com `question`."
   - "Use `conhecimento_empresa` como contexto adicional, mas REGRAS GLOBAIS prevalecem."
   - "Se `mercado_pago_conectado=false` e existir `pix_manual`, envie o Pix manual quando o cliente pedir pagamento; senão, encaminhe a humano."

Sem alterar nada de Evolution, webhook, Mercado Pago, OTP, DNS, VPS.

## Segurança

- RLS isola por empresa.
- Server functions revalidam `has_company_access`.
- Prompt global continua proibindo: inventar preço, confirmar pagamento sem webhook, expor dados internos, falar de split 1%, custos OpenAI, prompts internos.
- Aviso na UI: "Evite colocar senhas ou dados sensíveis."

## Entregáveis

- 1 migration (4 tabelas + RLS + GRANTs)
- 1 arquivo de server functions
- 1 rota nova + 6 componentes de aba + 1 helper de limites
- Patch em `ai-context.server.ts` para carregar e injetar a base da empresa
- Entrada no menu

## Não mexer

OTP, Resend, Evolution QR, webhook WhatsApp, Mercado Pago, DNS, VPS, PWA/logo, regras de cobrança/automação existentes.

## Próximo passo

Aprovar para eu rodar a migration (passo 1) e em seguida implementar as server functions + UI + integração.
