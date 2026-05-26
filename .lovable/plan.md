## Objetivo

Refinar o formulário "Novo teste" e o módulo de Indicações para:
1. Validar a quantidade de dígitos do WhatsApp (BR por padrão, com opção "fora do Brasil").
2. Substituir o campo "Valor (R$)" por um seletor de **Serviço cadastrado** (cada dono cadastra seus planos: ex. R$ 12, R$ 30).
3. Remover o campo "Interesse".
4. Reconhecer automaticamente quando o "WhatsApp indicador" pertence a um cliente já cadastrado e atualizá-lo.
5. Mostrar progresso da meta de indicações (ex.: "1 de 2 — falta 1"), notificar o indicador a cada fechamento e, ao bater a meta, **liberar a renovação automaticamente**, avisar o cliente, zerar o contador e manter histórico vitalício.

---

## Mudanças por arquivo

### 1. WhatsApp com validação (Testes + Indicações)
**Arquivos:** `src/routes/testes.tsx`, `src/routes/indicacoes.tsx`, possivelmente `src/lib/utils.ts` (helper)

- Adicionar checkbox **"Fora do Brasil"** ao lado/abaixo do campo WhatsApp.
- BR (padrão): aceitar apenas 10 ou 11 dígitos após DDI; máscara `(DD) 9XXXX-XXXX`; bloquear submit se inválido.
- Internacional: aceitar 8–15 dígitos (E.164), sem máscara BR, prefixo `+` livre.
- Helper `validateWhatsapp(value, { international: boolean })` retornando `{ ok, e164, error }`.
- Aplicar nos campos: WhatsApp do lead, WhatsApp do indicador, e também no cadastro de Clientes (`src/routes/clientes.tsx`) para consistência.

### 2. Catálogo de Serviços do dono
**Novos arquivos:**
- `src/lib/services-catalog.ts` — CRUD local (localStorage, escopado por `company_id`) com `{ id, nome, preco_cents, ativo }`.
- `src/routes/cadastros-servicos.tsx` — tela de cadastro (Nome + Preço, listar/editar/excluir/ativar). Acessível pelo menu **Cadastros**.

**Alterações:**
- `src/lib/nav.ts` — adicionar item "Serviços" no grupo Cadastros.
- `src/routeTree.gen.ts` — o plugin regenera automaticamente (não editar manualmente; o roteador detecta novos arquivos).
- `src/routes/testes.tsx` — substituir input "Valor (R$)" por `<Select>` listando serviços ativos do dono; o valor escolhido preenche `valor_cents` do lead. Se não houver serviço cadastrado, exibir aviso com link para "Cadastrar serviço".

### 3. Remover "Interesse"
**Arquivo:** `src/routes/testes.tsx`
- Remover bloco UI do grupo de botões Frio/Morno/Quente.
- Remover do payload de `saveTrialLead`.
- `src/lib/trial-leads.ts`: manter o campo no tipo por compatibilidade dos dados antigos, mas tornar opcional e parar de exigi-lo; default silencioso `"Morno"` na escrita para não quebrar exports antigos. Não exibir em nenhuma listagem.

### 4. Vincular indicador a cliente existente
**Arquivo:** `src/routes/testes.tsx` (form de Novo teste) e `src/routes/indicacoes.tsx` (Nova indicação)

- Ao digitar/blur no campo "WhatsApp indicador", normalizar para E.164 e buscar em `listCustomers()` (de `src/lib/companies.ts` ou equivalente já existente).
- Se encontrar: auto-preencher "Quem indicou" com nome do cliente, marcar `indicado_por_cliente_id`, mostrar badge "Cliente existente • {nome}".
- Se não encontrar: deixar como texto livre (comportamento atual).

### 5. Progresso, notificação e bonificação automática
**Arquivos:** `src/lib/referrals.ts`, `src/routes/indicacoes.tsx`, possivelmente `src/routes/testes.tsx` (no fluxo "Fechou")

#### a) Mostrar progresso na tela Indicações
- Já existe `summarizeByIndicador()` com `faltamParaMeta` e `bateuMeta`. Garantir que a UI mostre por indicador: **"X de META — falta Y"** + barra de progresso, lista de indicados (status), e botão "Avisar indicador" gerando mensagem WhatsApp pronta:
  > "Olá {nome}, a pessoa que você indicou (**{indicado}**) fechou! Você tem **X de {meta}** indicações confirmadas. Falta(m) **Y** para liberar sua bonificação."

#### b) Disparar lógica ao fechar uma indicação
No fluxo "Fechou" do teste (`src/routes/testes.tsx` → `ClosedDialog`):
- Após `archiveTrialLead`, se o lead tem `indicado_por_cliente_id` ou `indicado_por_whatsapp`, marcar a `Referral` correspondente como `"Fechou"` via `updateReferralByLead`.
- Recalcular o resumo do indicador.
- Se **não bateu meta**: abrir card com mensagem de progresso pronta (copiar / abrir WhatsApp).
- Se **bateu meta**: 
  - Marcar todas as `META` indicações fechadas mais antigas como `"Bonificação aplicada"` (zera o contador no `summarizeByIndicador` porque ele usa `fecharam % meta`).
  - Se `rules.tipo === "1mes"` (renovação): aplicar **renovação automática** no cliente indicador (estender `proximo_vencimento` em 30 dias) usando o helper de renovação manual existente em `src/lib/manual-renewals.ts` (ou função equivalente). Registrar evento no histórico.
  - Gerar mensagem de premiação para copiar/enviar:
    > "Parabéns, {nome}! Você completou {meta} indicações e ganhou **1 mês grátis**. Seu vencimento foi renovado para {nova_data}. Obrigado pela parceria!"
  - Mostrar toast no painel do dono: "Bonificação liberada para {nome}".

#### c) Histórico vitalício
- O `summarizeByIndicador` já conta histórico total (`total`, `fecharam`, `bonificacaoAplicada`). Adicionar na UI um detalhe expandível por indicador listando todas as indicações (data, indicado, status) — já temos os dados em `listReferrals()`. Acrescentar coluna/linha "Histórico: {fecharam} fechadas • {bonificacaoAplicada} bonificações aplicadas".

---

## Detalhes técnicos

- **Sem backend novo nesta etapa**: catálogo de serviços e bonificações continuam em `localStorage` escopados por `company_id` (segue o padrão atual de `trial-leads.ts` e `referrals.ts`).
- **Validação**: zod nos schemas dos formulários alterados; mensagens PT-BR.
- **Renovação automática**: usar o caminho que o app já usa para "renovar manualmente" o cliente; não vamos inventar RPC nova nem mexer no Supabase.
- **Não criar PR. Não fazer merge.**

---

## Itens fora de escopo (não fazer agora)

- Disparo automático de WhatsApp via API (continua mensagem pronta + `wa.me`).
- Bonificações dos tipos `desconto` / `valor` / `outro`: apenas avisar no painel + mensagem; não há aplicação automática (a renovação automática é só para `tipo === "1mes"`).
- Migração de dados antigos com "Interesse".
