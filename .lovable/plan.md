## Objetivo

Adicionar IA de suporte ao CobraEasy usando OpenAI **somente server-side**, com duas frentes:

1. **Ajuda com IA (Dono do painel)** — tira dúvidas sobre uso do sistema.
2. **IA Atendimento (Cliente final)** — responde sobre vencimento, status, pagamento, renovação, comprovante e suporte, restrito à empresa correta.

Sem mexer em: OTP/login, Mercado Pago, Resend, Evolution/VPS. Sem SQL nesta entrega.

---

## Arquitetura (segurança em 1ª camada)

- `OPENAI_API_KEY` armazenada como **secret** (server-only). Nunca `VITE_*`.
- Toda chamada à OpenAI passa por **server function TanStack** (`createServerFn`) — frontend nunca fala com `api.openai.com` direto.
- **Multi-tenant**: cada server function exige `requireSupabaseAuth` (Ajuda do Dono) ou validação de token público da empresa (Atendimento do Cliente final), e injeta apenas dados da empresa autorizada no contexto enviado ao modelo.
- **Sanitização de saída**: filtro remove UUIDs, JSON cru e stack traces antes de mostrar ao usuário.
- **Modelo econômico padrão**: `gpt-5-nano` (texto curto, custo baixo). Pode subir para `gpt-5-mini` em casos complexos.
- **Registro de uso**: gravar em `localStorage` por enquanto (sem SQL nesta entrega) — `cobraeasy_ai_usage_v1` com `{ at, scope, tokens_in, tokens_out, ok }`. Quando o usuário aprovar SQL, migramos para tabela `ai_usage_log`.

---

## Arquivos novos

```
src/lib/openai.server.ts                  // helper server-only (lê OPENAI_API_KEY, chama API)
src/lib/ai-help.functions.ts              // serverFn: askDonoHelp (requireSupabaseAuth)
src/lib/ai-customer.functions.ts          // serverFn: askCustomerHelp (token público + scope da empresa)
src/lib/ai-sanitize.ts                    // util isomórfica: remove UUID/JSON/stack
src/lib/ai-usage.ts                       // util local: registra uso/custo estimado
src/components/ai/AjudaIaPanel.tsx        // UI mobile-first do chat para o dono
src/components/ai/AtendimentoIaPanel.tsx  // UI mobile-first para o cliente final
src/routes/ajuda-ia.tsx                   // rota /ajuda-ia (dono) — adicionada ao menu
src/routes/atendimento-ia.$token.tsx      // rota pública para cliente final (link enviado por WhatsApp)
```

## Arquivos alterados (mínimo)

```
src/lib/nav.ts                            // adiciona item "Ajuda com IA"
src/components/layout/AppSidebar.tsx      // só se necessário (provavelmente nav.ts basta)
```

> Não toco em: auth, billing, mercado-pago, evolution, resend, OTP.

---

## Variáveis necessárias

- `OPENAI_API_KEY` — secret server-only (vou solicitar via `add_secret`).
- (opcional, com default no código) `OPENAI_MODEL_DEFAULT=gpt-5-nano`.

Nenhuma variável `VITE_*` é criada.

---

## Fluxo Dono (Ajuda com IA)

1. Dono abre `/ajuda-ia` (logado).
2. Digita pergunta em PT-BR.
3. Frontend chama `askDonoHelp({ data: { question, contextHints } })`.
4. Server function:
   - valida sessão (`requireSupabaseAuth`)
   - monta system prompt com escopo: clientes, cobranças, testes, serviços, importação XLSX/PDF, Mercado Pago (uso, não config), assinatura, vencimentos, mensagens automáticas, backup/exportação
   - chama OpenAI (`responses` API, modelo econômico)
   - sanitiza saída
   - retorna `{ answer, usage }`
5. UI exibe resposta curta, com botão "Falar com suporte humano" caso a IA não saiba.

## Fluxo Cliente final (Atendimento IA)

1. Cliente acessa `/atendimento-ia/<token>` (link enviado pela empresa via WhatsApp).
2. Server function `askCustomerHelp` valida o token, descobre `company_id` + `customer_id` **server-side** (lookup), e injeta no contexto **apenas**:
   - nome do plano
   - vencimento
   - status (em dia / vencido / em teste)
   - última cobrança
   - instruções de pagamento da empresa (PIX/link)
3. **Nunca** envia para o modelo dados de outra empresa, UUIDs, e-mails de outros clientes, nem JSON cru.
4. Se a pergunta sair do escopo: resposta padrão "Não consigo te ajudar com isso, fale com o suporte da sua empresa".

> Observação: a geração desse token público de cliente entra em uma 2ª tarefa, quando o usuário aprovar SQL. Por enquanto a rota existe e fica em "modo demo seguro" — não retorna dados reais sem o backend de token pronto. Isso evita vazamento.

---

## Sanitização (regra fixa)

`sanitizeAiOutput(text)`:
- remove UUIDs `[0-9a-f-]{32,}`
- remove blocos ```` ```json ... ``` ````
- corta stack traces (`at \w+ \(.*:\d+:\d+\)`)
- corta menções a tabelas/colunas internas (`auth.`, `public.`, `SUPABASE`, `RLS`)
- substitui por texto amigável quando algo for removido

---

## Registro de uso (sem SQL)

`ai-usage.ts` mantém últimos 500 eventos em `localStorage`, com estimativa de custo por modelo. Visível para o dono em `/ajuda-ia` (rodapé "Você usou X perguntas hoje").

Quando o usuário aprovar SQL, migramos para `ai_usage_log (company_id, scope, model, tokens_in, tokens_out, created_at)` + RLS — entrega separada.

---

## UX (mobile-first, 390px)

- Chat em coluna única, balões empilhados, input fixo no rodapé.
- Sem rolagem horizontal.
- Texto PT-BR simples, sem termos técnicos.
- Botão "Limpar conversa" e "Falar com suporte humano" sempre visíveis.

---

## Entrega prevista

- **Arquivos alterados/criados**: lista acima.
- **Variáveis necessárias**: `OPENAI_API_KEY` (solicitada via `add_secret`).
- **SQL aplicado**: NÃO.
- **Build**: validado automaticamente após a implementação.
- **PR**: NÃO.
- **MERGE**: NÃO.

---

## O que preciso de você antes de codar

1. Confirmar este plano (posso seguir?).
2. Você vai colar `OPENAI_API_KEY` quando eu pedir via `add_secret`.
3. Confirmar: a rota pública do cliente final pode ficar em "modo seguro / sem dados reais" nesta entrega? (O backend de token de cliente exige SQL — fica para tarefa separada.)
