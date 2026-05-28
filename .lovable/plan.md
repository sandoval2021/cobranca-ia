## Escopo
Base profissional para vender CobraEasy: planos SaaS com limite mensal de respostas IA, contador no painel, e estrutura de renovação assistida (sem API de painel IPTV) + apps MAC/Key.

Antes de aplicar SQL, segue arquitetura proposta para sua aprovação.

---

## 1. Tabelas propostas

### A) Planos SaaS e assinaturas (CobraEasy → dono do painel)

**`saas_plans`** (catálogo, gerenciado pelo super_admin)
- `id`, `slug` (essencial|profissional|escala), `name`, `price_cents`, `ai_monthly_limit` (int), `is_active`, `sort_order`

**`saas_extra_packs`** (pacotes adicionais de respostas)
- `id`, `slug`, `name`, `ai_extra_responses`, `price_cents`, `is_active`

**`company_subscriptions`** (assinatura ativa de cada empresa)
- `id`, `company_id` (unique), `plan_id`, `status` (trial|active|past_due|canceled|paused_limit), `current_period_start`, `current_period_end`, `cancel_at_period_end`, `last_payment_at`

**`company_ai_usage_cycle`** (contador mensal — fonte da verdade)
- `id`, `company_id`, `cycle_start`, `cycle_end`, `base_limit`, `extra_limit`, `used_count`, `last_increment_at`
- unique (company_id, cycle_start)

**`company_extra_pack_purchases`** (pacotes comprados no ciclo atual)
- `id`, `company_id`, `pack_id`, `cycle_start`, `extra_responses`, `purchased_at`

### B) Renovação assistida IPTV (servidores/painéis)

Reaproveitar `servers` existente + adicionar colunas:
- `panel_url`, `panel_username`, `panel_password_enc` (criptografada server-side), `panel_type` (sigma|xui|xtream|outros), `customer_search_url_template` (ex: `https://painel.com/users?search={username}`), `notes`

**`customer_iptv_credentials`** (1:N por cliente)
- `id`, `company_id`, `customer_id`, `server_id`, `iptv_username`, `iptv_password_enc`, `mac`, `device_key`, `app_used`, `plan_days`, `expires_at`, `notes`

### C) Apps portal (Bob/IBO/VU/Smarters etc.)

**`portal_apps`** (cadastro por empresa)
- `id`, `company_id`, `app_name`, `panel_url`, `panel_login`, `panel_password_enc`, `id_type` (mac|key|both), `mac_url_template`, `key_url_template`, `notes`, `is_active`

**`customer_portal_devices`** (cliente x app)
- `id`, `company_id`, `customer_id`, `portal_app_id`, `mac`, `device_key`, `current_route`, `last_updated_at`

### D) Fila de renovação (base para Playwright futuro)

**`renewal_tasks`**
- `id`, `company_id`, `customer_id`, `server_id`, `kind` (iptv|portal), `status` (pending|trying|renewed|failed|needs_human), `attempts`, `last_error`, `screenshot_url`, `created_at`, `completed_at`, `assigned_to`

### E) Logs de acesso a credenciais

**`credential_access_log`**
- `id`, `company_id`, `user_id`, `target_kind` (server|customer_iptv|portal_app|customer_portal), `target_id`, `action` (view|copy|reveal), `created_at`

---

## 2. Fluxo de limite IA

```
mensagem chega → buildAiContext
  ↓
ensureAiQuota(company_id)
  ├─ pega/cria ciclo corrente (saas_plans.ai_monthly_limit + soma extras)
  ├─ used >= base+extra?
  │   ├─ SIM → marca subscription.status=paused_limit
  │   │        envia alerta para human_handoff_number (1x por ciclo)
  │   │        responde "limite atingido, aguarde renovação" OU silencia
  │   │        NÃO chama OpenAI
  │   └─ NÃO → chama OpenAI normalmente
  ↓
após resposta enviada → incrementAiUsage()
  ├─ UPDATE company_ai_usage_cycle SET used_count = used_count + 1
  └─ já gravamos custo em ai_usage_log (existente)
```

Reset: ao renovar (`current_period_start` muda) → cria novo registro `company_ai_usage_cycle`, `used_count=0`, `extra_limit=0`. Saldo não acumula.

---

## 3. Card no painel (rota `/meus-dados` ou novo widget no dashboard)

```
┌──────────────────────────────────────────┐
│ IA do mês · Plano Profissional           │
│ ████████████░░░░░░  3.250 / 15.000 (22%) │
│ Ciclo termina em 12 dias                 │
│ ⚠ aviso aos 70% · alerta aos 90% · pausa 100% │
│ [Comprar pacote extra] [Ver histórico]   │
└──────────────────────────────────────────┘
```

Server fn `getAiQuotaStatus()` retorna `{ plan, used, base_limit, extra_limit, percent, days_left, status }`.

---

## 4. Renovação assistida — UI

Pagamento confirmado (webhook MP já existe) → cria `renewal_tasks(status=pending)` → aparece em **/operacao-dia** como card:

```
Renovar João Silva · servidor SuperFlix
┌─ Dados ──────────────────────────┐
│ Usuário: joaosilva  [📋 copiar]  │
│ Senha:   •••••••   [👁 revelar] [📋]│
│ MAC:     00:1A:..  [📋]          │
│ Plano:   30 dias                 │
└──────────────────────────────────┘
[🌐 Abrir painel] [✅ Marcar renovado] [👤 Precisa humano]
```

Cada clique em copiar/revelar → INSERT em `credential_access_log`.

---

## 5. Segurança

- `panel_password_enc`, `iptv_password_enc` → criptografadas com `pgsodium` ou AES via server function (chave em env `CREDENTIALS_ENC_KEY`)
- Revelação só via server fn (`requireSupabaseAuth` + `has_company_access`) + log
- RLS por `company_id` em todas as novas tabelas
- Service role só server-side (padrão do projeto)
- Frontend mostra senha mascarada por default; botão "revelar" faz round-trip server

---

## 6. Telas a adicionar

| Rota | Função |
|------|--------|
| `/saas-planos` (super_admin) | CRUD de `saas_plans` e `saas_extra_packs` |
| `/minha-assinatura` (dono) | Plano atual, ciclo, card de uso IA, compra de extras |
| `/operacao-dia` (existente) | Adiciona seção "Renovações pendentes" |
| `/catalogo-servidores` (existente) | Adiciona campos de credencial de painel |
| `/apps-portal` (novo) | CRUD de `portal_apps` |
| Ficha do cliente (existente) | Aba "Credenciais IPTV" + "Dispositivos/MAC" |

---

## 7. Escopo desta entrega (FASE 1 — base)

Para evitar SQL gigante de uma vez, proponho dividir em 3 migrações:

**Migração 1 — Planos SaaS + contador IA + gate (CRÍTICO, alta prioridade)**
- `saas_plans`, `saas_extra_packs`, `company_subscriptions`, `company_ai_usage_cycle`, `company_extra_pack_purchases`
- Seed dos 3 planos (Essencial/Profissional/Escala)
- Server fns: `getAiQuotaStatus`, `ensureAiQuota`, `incrementAiUsage`
- Hook em `ai-reply.server.ts` (gate antes do OpenAI + incremento depois)
- Card no painel + rota `/minha-assinatura` (read-only desta fase)
- Rota `/saas-planos` para super_admin

**Migração 2 — Credenciais IPTV + renovação assistida**
- Colunas em `servers`, tabela `customer_iptv_credentials`, `renewal_tasks`, `credential_access_log`
- UI de renovação assistida no `/operacao-dia`
- Criptografia de senhas + server fns reveal/copy com log

**Migração 3 — Apps portal MAC/Key**
- `portal_apps`, `customer_portal_devices`
- Rota `/apps-portal` + aba no cliente

---

## 8. Riscos

- **Criptografia de senhas**: precisa de `CREDENTIALS_ENC_KEY` (secret novo). Se você esquecer, perde acesso às senhas salvas. Alternativa: pgsodium server-side keys.
- **Gate de IA**: se ciclo não estiver criado, primeira mensagem pode bloquear. Mitigação: `ensureAiQuota` auto-cria ciclo na primeira chamada.
- **Migração de empresas existentes**: todas vão ganhar plano "Essencial" trial 14 dias por default. Confirmar se OK.
- **Playwright**: NÃO entra agora. Só estrutura de fila (`renewal_tasks`).

---

## 9. Perguntas antes de aplicar

1. **Aprovar dividir em 3 migrações** (Fase 1 primeiro) ou aplicar tudo de uma vez?
2. **Empresas existentes**: começam em "Essencial trial 14 dias" ou "Profissional liberado até você ajustar"?
3. **Comportamento ao atingir 100%**: IA responde "limite atingido, fale com o suporte" OU silencia totalmente?
4. **Criptografia de senhas de painel**: usar `pgsodium` (mais seguro, lock-in Supabase) ou AES com secret `CREDENTIALS_ENC_KEY` (portável)?

Confirma esses 4 pontos e eu sigo direto para a **Migração 1** + código. SQL aplicado: NÃO ainda. Build: não tocado. PR/MERGE: NÃO.