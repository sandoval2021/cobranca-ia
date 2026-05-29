-- Fase B — Idempotência: NUNCA apaga dados. Colunas novas são nullable.
-- Constraints UNIQUE adicionadas são seguras porque (1) tabelas envolvidas
-- estão vazias hoje (verificado) e (2) NULL é distinto em UNIQUE no Postgres,
-- então registros antigos sem a chave nova não conflitam.

-- ============================================================
-- 1) saas_webhook_events — controle de eventos do webhook SaaS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.saas_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'mercado_pago',
  data_id text NOT NULL,
  event_type text NOT NULL DEFAULT 'payment',
  external_reference text,
  company_id uuid,
  status text NOT NULL DEFAULT 'received',
  error_message text,
  raw_reference jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.saas_webhook_events TO authenticated;
GRANT ALL ON public.saas_webhook_events TO service_role;

ALTER TABLE public.saas_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members view their saas_webhook_events" ON public.saas_webhook_events;
CREATE POLICY "members view their saas_webhook_events"
  ON public.saas_webhook_events FOR SELECT
  TO authenticated
  USING (company_id IS NOT NULL AND has_company_access(company_id));

DROP POLICY IF EXISTS "super_admin views all saas_webhook_events" ON public.saas_webhook_events;
CREATE POLICY "super_admin views all saas_webhook_events"
  ON public.saas_webhook_events FOR SELECT
  TO authenticated
  USING (is_super_admin());

-- Chave de idempotência: mesmo provedor + mesmo pagamento + mesmo tipo
-- de evento só pode existir uma vez.
CREATE UNIQUE INDEX IF NOT EXISTS uq_saas_webhook_events_provider_data_type
  ON public.saas_webhook_events (provider, data_id, event_type);

CREATE INDEX IF NOT EXISTS idx_saas_webhook_events_company
  ON public.saas_webhook_events (company_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_saas_webhook_events_extref
  ON public.saas_webhook_events (external_reference);

-- ============================================================
-- 2) payment_transactions — idempotency_key
-- ============================================================
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- UNIQUE(company_id, idempotency_key) só vale quando idempotency_key não é
-- NULL (NULL distinto em UNIQUE). Implementado via índice único parcial
-- para não impactar linhas antigas sem chave.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_tx_company_idem
  ON public.payment_transactions (company_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ============================================================
-- 3) payment_split_logs — único log por transação
-- ============================================================
-- Fluxo atual sempre insere exatamente um split log por payment_transaction.
-- Backfill desnecessário (tabela vazia, verificado). Em runtime, viramos
-- para upsert (onConflict: transaction_id) — ver código.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_split_logs_tx
  ON public.payment_split_logs (transaction_id);

-- ============================================================
-- 4) finance_entries — idempotency_key
-- ============================================================
ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_entries_company_idem
  ON public.finance_entries (company_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ============================================================
-- 5) renewal_tasks — source_payment_id + UNIQUE composta
-- ============================================================
ALTER TABLE public.renewal_tasks
  ADD COLUMN IF NOT EXISTS source_payment_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_renewal_tasks_company_customer_payment
  ON public.renewal_tasks (company_id, customer_id, source_payment_id)
  WHERE source_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_renewal_tasks_source_payment
  ON public.renewal_tasks (source_payment_id)
  WHERE source_payment_id IS NOT NULL;

-- ============================================================
-- 6) saas_checkout_sessions — external_reference UNIQUE
-- ============================================================
-- Tabela vazia hoje (verificado); seguro tornar UNIQUE.
CREATE UNIQUE INDEX IF NOT EXISTS uq_saas_checkout_sessions_extref
  ON public.saas_checkout_sessions (external_reference);
