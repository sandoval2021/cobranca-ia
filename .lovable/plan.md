## Objetivo

Eliminar `localStorage` como fonte da verdade para tudo que afeta cobrança automática e IA comercial:

- **Planos do dono** (nome, preço, telas, meses, ativo) — hoje em `services-catalog.ts`
- **Mensagens por plano** (cobrança no dia, acompanhamentos N dias depois) — hoje aninhadas dentro de cada plano local
- **Plano vinculado ao cliente** — hoje em `customer-plans.ts`
- **Regras de disparo manual** (lembrete D-7, cobrança D-0, recuperação D+7…) — hoje em `manual-dispatch-rules.ts`
- **Config de disparo automático** (horário, intervalo, lote, dias permitidos, horários por valor) — hoje em `auto-dispatch.ts`

Depois disso, IA, cobrança automática e valores por plano ficam iguais em desktop, celular e PWA.

`localStorage` permanece apenas como cache de leitura síncrona + flags efêmeras (cancelados/enviados do dia).

## Escopo desta tarefa (Fase 2A) — apenas Planos e Mensagens

A migração inteira é grande (5 módulos, 8+ consumidores, ~3500 linhas em `clientes.tsx`). Para entregar com segurança igual à Fase 1 (telas), corto a Fase 2 em duas:

- **Fase 2A (esta tarefa)**: Planos do dono + Mensagens do plano + Vínculo cliente↔plano.
- **Fase 2B (próxima tarefa)**: Regras de disparo manual + Config de disparo automático.

Motivo: 2A é o que afeta diretamente "valor do plano" e "mensagens por vencimento" mencionados pelo usuário. 2B é UX de agenda; pode ir em seguida sem bloquear cobrança/IA.

## Banco — Fase 2A

Três tabelas novas no schema `public`, todas com RLS por `has_company_access`:

```text
service_plans
  id uuid pk
  company_id uuid not null
  nome text not null
  preco_cents int not null default 0
  telas int not null default 1
  meses int not null default 1
  ativo bool not null default true
  created_at, updated_at timestamptz

service_plan_messages
  id uuid pk
  company_id uuid not null   -- denormalizado p/ RLS direto
  service_plan_id uuid not null references service_plans(id) on delete cascade
  kind text not null check (kind in ('cobranca','acompanhamento'))
  offset_days int not null default 0
  label text not null
  template text not null
  created_at, updated_at timestamptz

customer_service_plan
  customer_id uuid pk references customers(id) on delete cascade
  company_id uuid not null
  service_plan_id uuid not null references service_plans(id) on delete cascade
  updated_at timestamptz
```

GRANTs para `authenticated` (SELECT/INSERT/UPDATE/DELETE) + `service_role` ALL. RLS: `has_company_access(company_id)` em todas as policies. Sem grant para `anon`.

Não reaproveito `price_group_plans` porque ele pertence ao módulo de "grupos de preço" (já em uso) e tem semântica diferente (`price_group_id`, `duration_days`, `allow_installments`). Misturar quebra a UI atual de grupos.

## Código — Fase 2A

Mesma arquitetura validada na Fase 1 de telas:

1. **`src/lib/services/services.functions.ts` (novo)** — `listPlansDb`, `upsertPlanDb`, `deletePlanDb`, `bulkUpsertPlansDb`, `setCustomerPlanDb` com `requireSupabaseAuth` + `has_company_access`. Mensagens enviadas/lidas junto com o plano (sub-array).
2. **`src/lib/services/useServicesSync.ts` (novo)** — hidrata cache local de planos + vínculos em mount/focus/troca de empresa/5 min, igual ao `useScreensSync`.
3. **`src/lib/services-catalog.ts` (editar)** — normalizar IDs para UUID, manter API síncrona (`listServices`, `saveService`, `updateService`, `deleteService`, mensagens), e em cada mutação disparar upsert/delete no banco em background (fire-and-forget). Adicionar `hydrateServicesFromDb`, `getServicesSyncState`, `uploadLocalServicesToDb`, `SERVICES_SYNC_EVENT`, e `pendingLocal` (banco vazio + cache com dados → preserva).
4. **`src/lib/customer-plans.ts` (editar)** — mesma estratégia: cache local + `setCustomerPlanDb` em background; hidratação via `useServicesSync` (uma chamada só traz planos + vínculos da empresa).
5. **`src/routes/__root.tsx` (editar)** — montar `useServicesSync()` ao lado do `useScreensSync()`.
6. **`src/routes/cadastros-servicos.tsx` (editar)** — adicionar banner "Enviar para minha conta" quando `pendingLocal > 0`, idêntico em UX ao banner de telas (compacto, mobile-first, botão grande, "Agora não"). Após upload, re-hidratar e atualizar lista.

## Garantias

- Banco é fonte da verdade; `localStorage` é cache.
- Nunca sobrescrever banco com vazio (`pendingLocal` protege).
- Nunca apagar cache local antes do banco confirmar.
- Upsert por id evita duplicidade; IDs migrados para UUID.
- `company_id` correto em todos os writes (vem de `getActiveCompanyId`, validado).
- Vínculo cliente↔plano permanece (`customer_service_plan` é upsert por `customer_id`).
- Sem alteração funcional em IA, WhatsApp, Mercado Pago, DNS.

## Fora de escopo (vai para Fase 2B)

- `manual-dispatch-rules.ts` (regras D-7/D0/D+7) → nova tabela `dispatch_rules`.
- `auto-dispatch.ts` (config global + horários por valor) → nova tabela `auto_dispatch_config` (1 linha por empresa) + `auto_dispatch_amount_schedules`.
- Flags do dia (`cobranca_ia_auto_dispatch_cancel_v1`, `sent_v1`) permanecem em `localStorage` (efêmeras, 14 dias, por aparelho).

## Riscos e mitigação

- **Risco**: ~8 arquivos consomem `listServices()` / `getCustomerPlan()` de forma síncrona; primeira render pode mostrar lista vazia até hidratar (~200 ms). **Mitigação**: cache local responde sync imediatamente; hidrate só substitui depois, evento `SERVICES_SYNC_EVENT` força re-render onde precisar.
- **Risco**: dono com planos antigos só locais. **Mitigação**: banner explícito de migração, idêntico ao que já validamos para telas.

## Entrega

- SQL aplicado: SIM (3 tabelas novas + RLS + GRANTs)
- PR: NÃO
- Merge: NÃO
- Build OK obrigatório
