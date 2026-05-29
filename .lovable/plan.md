## Já feito nesta mensagem
- "Configuração Inicial" e "Backup Geral" marcados como `superAdminOnly` no `src/lib/nav.ts` (somem do menu do Dono).
- Toggles "Aceita áudio" e "Oferecer teste automaticamente" removidos da aba Regras em `src/routes/treinar-ia.tsx`.
- Bloco "URL do webhook" removido de `src/routes/pagamentos.mercado-pago.tsx`.

## A fazer (4 frentes maiores)

### 1. Trial = 7 dias e bloqueio pós-trial
- Migration: alterar `public.company_subscriptions.current_period_end` default de `now() + 30 days` → `now() + 7 days`. Atualizar `get_or_create_current_ai_cycle` para usar 7 dias quando cria trial. Atualizar `company_subscriptions` existentes em status `trial` para `current_period_end = current_period_start + 7 days`.
- Frontend: criar `TrialGuard` em `src/components/auth/TrialGuard.tsx` que usa `getAiQuotaStatus` e, se `subscription.status='trial'` e `days_left <= 0` (ou status `past_due`/`canceled`), redireciona qualquer rota que não seja `/minha-assinatura`, `/login`, `/auth`, `/reset-password`, `/pagar/*` para `/minha-assinatura` com banner "Seu período de teste acabou. Escolha um plano para continuar."
- Plugar o guard no `__root.tsx` ou no `AppShell` (após autenticação).

### 2. Botão "Assinar" em cada plano (Mercado Pago)
- Criar `createSaasCheckout` server fn em `src/lib/billing-saas/billing-saas.functions.ts`: recebe `{ companyId, planId }`, cria uma `preference` no Mercado Pago usando `MERCADO_PAGO_PLATFORM_ACCESS_TOKEN` (token da plataforma, não do dono). Grava em uma nova tabela `saas_checkout_sessions` (company_id, plan_id, preference_id, status, created_at) para reconciliar via webhook.
- Webhook: estender `src/routes/api/public/mp/marketplace-webhook.ts` (ou criar `saas-webhook.ts`) para, ao receber `payment.approved`, atualizar `company_subscriptions` para `status='active'`, `current_period_start=now()`, `current_period_end=now()+30 days`.
- UI: em `src/routes/minha-assinatura.tsx`, cada card de plano ganha botão **"Assinar"** que chama a server fn e redireciona para `init_point` do MP. Adicionar feedback de "abrindo checkout…".

### 3. Catálogo de servidores por empresa (sem vazar do admin)
- Investigar `src/lib/server-catalog.ts` para ver se está em localStorage ou banco.
- Se localStorage global: passar a chave por `company_id` (`server_catalog_v1__<companyId>`) e migrar leitura/escrita.
- Se já está no banco: revisar a query — provavelmente está sem `eq('company_id', activeCompanyId)`. Corrigir e garantir RLS por empresa.

### 4. Filtrar artigos de Ajuda
- Em `src/lib/help-center.ts`, adicionar campo opcional `audience?: 'super_admin' | 'owner' | 'all'` em `HELP_ARTICLES` (default `'all'`). Marcar como `super_admin` os artigos que falam de: diagnóstico, marketplace admin, super admin, configurações de sistema, regras de disparo automático, base da IA global, etc.
- Em `src/routes/ajuda.tsx`, filtrar `HELP_ARTICLES` por `isSuperAdmin || a.audience !== 'super_admin'` antes de exibir.

## Decisões já tomadas pelo usuário
- Bootstrap super admin: já existe DB → não precisa mais permitir bootstrap. A conta `lendariomcz@gmail.com` não tem role `super_admin` no banco (só `sandovaloliveira284@gmail.com` tem). O badge "Admin interno" provavelmente é só badge de trial — vai sumir com o item 1 (trial 7 dias).
- Pós-trial: bloquear tudo, liberar só `/minha-assinatura`.
- Pagamento: botão "Assinar" via MP da plataforma.
- Servidores: por empresa.

## Fora de escopo desta entrega
- Simplificar visualmente a tela de campanhas/renovações (item "muito bagunçado") — fica para próxima rodada para não inflar este PR.
- Limpar visualmente outras telas com excesso de chips.

Build: rodado pelo harness após cada etapa. Sem PR. Sem merge.