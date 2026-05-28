# Integração Mercado Pago Marketplace/Split — CobraEasy

## Visão geral

Integração multi-tenant onde cada dono conecta sua conta Mercado Pago via OAuth. O CobraEasy cobra 1% via `application_fee` em cada pagamento (split nativo do Mercado Pago). Backend é fonte da verdade; tokens criptografados; webhook idempotente.

## Fase 1 — Fundação (SQL + OAuth)

### 1.1 Migration SQL (será apresentada antes de aplicar)

Tabelas novas em `public`:

- **`marketplace_accounts`** — conta MP conectada por empresa
  - `company_id` (unique), `mp_user_id`, `access_token_enc`, `refresh_token_enc`, `expires_at`, `public_key`, `status` (`connected`/`disconnected`/`error`/`expired`), `last_error`, `connected_at`
- **`payment_settings`** — config de taxa por empresa
  - `company_id` (unique), `platform_fee_bps` (default 100 = 1%), `fee_mode` (`customer_pays`/`owner_pays`, default `customer_pays`), `is_active`
- **`payment_transactions`** — cobranças geradas
  - `company_id`, `customer_id`, `amount_cents` (valor do plano), `processing_fee_cents`, `total_amount_cents` (o que cliente paga), `fee_mode`, `status` (`pending`/`approved`/`rejected`/`cancelled`/`refunded`), `payment_method` (`pix`/`card`/`link`), `external_reference` (unique), `mp_payment_id`, `mp_preference_id`, `qr_code`, `qr_code_base64`, `ticket_url`, `paid_at`, `expires_at`, `raw_response` jsonb
- **`payment_split_logs`** — log de cada split executado
  - `transaction_id`, `application_fee_cents`, `owner_amount_cents`, `mp_response` jsonb, `status`, `error`
- **`mercado_pago_webhook_events`** — idempotência
  - `mp_event_id` (unique), `mp_topic`, `mp_resource_id`, `processed_at`, `status`, `raw_payload` jsonb, `transaction_id`

RLS: dono via `has_company_access(company_id)`, super_admin bypass, escrita sensível via `service_role`. GRANTs explícitos. Tokens nunca lidos pelo cliente — usar coluna `_enc` + função server-side.

### 1.2 Secrets necessários

Pedir ao usuário via `add_secret`:
- `MERCADO_PAGO_CLIENT_ID` — OAuth do app marketplace CobraEasy
- `MERCADO_PAGO_CLIENT_SECRET` — OAuth secret
- `MERCADO_PAGO_PLATFORM_ACCESS_TOKEN` — conta MP do CobraEasy (recebe os 1%)
- `MERCADO_PAGO_WEBHOOK_SECRET` — validação de assinatura
- `CREDENTIALS_ENC_KEY` — já existe ✓

### 1.3 OAuth (server-side)

- `src/lib/payments/mp-oauth.server.ts` — troca code→token, refresh
- Server fn `getMpAuthUrl` — gera URL `https://auth.mercadopago.com.br/authorization?...&state=<companyId-signed>`
- Server route `/api/public/mp/oauth/callback` — recebe `code`, troca por token, criptografa, salva
- Server fn `disconnectMercadoPago`, `getMpAccountStatus`

## Fase 2 — Cobrança + Split

### 2.1 Server fns (`src/lib/payments/payments.functions.ts`)

- `createPayment({ customerId, amountCents, method, description })` — usa token do dono, aplica `application_fee` = 1%, cria preference (link) ou payment Pix, persiste em `payment_transactions`, retorna `{ qrCode, ticketUrl, externalReference }`
- `listPayments({ filter })` — histórico para painel dono
- `getPaymentSettings` / `updatePaymentSettings` — config taxa

### 2.2 Cálculo da taxa

```
plano = 100,00
fee = 1% = 1,00
customer_pays → total = 101,00; owner recebe 100,00; CobraEasy 1,00
owner_pays    → total = 100,00; owner recebe 99,00;  CobraEasy 1,00
```

### 2.3 Webhook idempotente

- `src/routes/api/public/mp/webhook.ts` — POST
- Valida assinatura (`x-signature` HMAC do MP), insere em `mercado_pago_webhook_events` (UNIQUE em `mp_event_id` garante idempotência), busca payment por `external_reference`, atualiza status, registra split em `payment_split_logs`, dispara renovação (cria `renewal_tasks`) e WhatsApp.

## Fase 3 — Telas

### 3.1 Painel do dono
- **`/pagamentos/mercado-pago`** — status conexão, botão conectar/desconectar, escolha `fee_mode` com explicação amigável dos dois cenários, exemplo de cálculo dinâmico
- **`/pagamentos/historico`** — lista transações com filtros (aprovados/pendentes/falhos), totais
- Adicionar item no `src/lib/nav.ts`

### 3.2 Tela pública do cliente
- **`/pagar/$externalReference`** — mostra "Valor do plano", "Taxa de processamento" (só se `customer_pays`), "Total a pagar", QR Pix + copia-cola + botão link. Nunca usar termos "comissão", "taxa do dono", "CobraEasy" no rótulo.

### 3.3 Super admin
- **`/admin/marketplace`** — empresas conectadas, volume processado, taxas geradas, erros de webhook/split

## Fase 4 — IA + Renovação

- `src/lib/whatsapp/ai-reply.server.ts` — adicionar tool `generate_payment_link` que só dispara se `marketplace_accounts.status='connected'`. Se não conectado, IA responde pedindo dono configurar.
- Após webhook `approved`: criar `renewal_tasks` (assistida) — só confirma renovação ao cliente após execução real.

## Detalhes técnicos

- **Bibliotecas**: usar `fetch` direto (Mercado Pago REST). Não instalar SDK Node (Worker runtime).
- **Endpoints MP**:
  - OAuth: `POST https://api.mercadopago.com/oauth/token`
  - Preference: `POST /checkout/preferences` com `marketplace_fee`
  - Pix payment: `POST /v1/payments` com `application_fee`, header `Authorization: Bearer <ownerToken>`
- **Criptografia**: reusar `src/lib/iptv/crypto.server.ts` (AES-GCM com `CREDENTIALS_ENC_KEY`).
- **State OAuth**: HMAC do `companyId` com `MERCADO_PAGO_WEBHOOK_SECRET` para prevenir CSRF.

## Não mexer
OTP/login, Resend, Evolution QR, webhook WhatsApp existente, IA atual, DNS, VPS.

## Entrega
Build OK | SQL aplicado: SIM (após aprovação) | PR: NÃO | MERGE: NÃO

## Próximo passo

Confirme:
1. Aprovar este plano para eu começar pela **migration SQL** (apresento o SQL para você aprovar antes de aplicar).
2. Você tem app Mercado Pago Marketplace criado em https://www.mercadopago.com.br/developers/panel/app? Precisarei dos secrets `MERCADO_PAGO_CLIENT_ID`, `MERCADO_PAGO_CLIENT_SECRET`, `MERCADO_PAGO_PLATFORM_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`.
