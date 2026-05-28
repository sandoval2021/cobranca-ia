
-- ============================================================
-- MARKETPLACE ACCOUNTS (conta Mercado Pago do dono)
-- ============================================================
CREATE TABLE public.marketplace_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'mercado_pago',
  mp_user_id text,
  access_token_enc text,
  refresh_token_enc text,
  public_key text,
  expires_at timestamptz,
  scope text,
  live_mode boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'disconnected', -- connected | disconnected | error | expired
  last_error text,
  connected_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_accounts TO authenticated;
GRANT ALL ON public.marketplace_accounts TO service_role;

ALTER TABLE public.marketplace_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view marketplace_accounts"
  ON public.marketplace_accounts FOR SELECT TO authenticated
  USING (public.has_company_access(company_id));

-- Inserts/updates são feitos via backend (service_role) com tokens criptografados.
-- Dono pode disparar disconnect (update status) — restringimos a colunas via server fn.
CREATE POLICY "members update marketplace_accounts status"
  ON public.marketplace_accounts FOR UPDATE TO authenticated
  USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

CREATE TRIGGER trg_marketplace_accounts_touch
  BEFORE UPDATE ON public.marketplace_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- PAYMENT SETTINGS (configuração de taxa por empresa)
-- ============================================================
CREATE TABLE public.payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE,
  platform_fee_bps integer NOT NULL DEFAULT 100, -- 100 bps = 1%
  fee_mode text NOT NULL DEFAULT 'customer_pays', -- customer_pays | owner_pays
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_settings_fee_mode_chk CHECK (fee_mode IN ('customer_pays','owner_pays')),
  CONSTRAINT payment_settings_fee_bps_chk CHECK (platform_fee_bps >= 0 AND platform_fee_bps <= 1000)
);

GRANT SELECT, INSERT, UPDATE ON public.payment_settings TO authenticated;
GRANT ALL ON public.payment_settings TO service_role;

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view payment_settings"
  ON public.payment_settings FOR SELECT TO authenticated
  USING (public.has_company_access(company_id));

CREATE POLICY "members insert payment_settings"
  ON public.payment_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "members update payment_settings"
  ON public.payment_settings FOR UPDATE TO authenticated
  USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

CREATE TRIGGER trg_payment_settings_touch
  BEFORE UPDATE ON public.payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- PAYMENT TRANSACTIONS (cobranças)
-- ============================================================
CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  customer_id uuid,
  external_reference text NOT NULL UNIQUE,
  description text,
  amount_cents integer NOT NULL,         -- valor do plano/serviço
  processing_fee_cents integer NOT NULL DEFAULT 0, -- taxa de processamento (1%)
  total_amount_cents integer NOT NULL,   -- o que o cliente efetivamente paga
  fee_mode text NOT NULL DEFAULT 'customer_pays',
  payment_method text NOT NULL DEFAULT 'pix', -- pix | card | link
  status text NOT NULL DEFAULT 'pending',      -- pending | approved | rejected | cancelled | refunded | expired
  mp_payment_id text,
  mp_preference_id text,
  qr_code text,
  qr_code_base64 text,
  ticket_url text,
  init_point text,
  expires_at timestamptz,
  paid_at timestamptz,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_transactions_fee_mode_chk CHECK (fee_mode IN ('customer_pays','owner_pays')),
  CONSTRAINT payment_transactions_method_chk CHECK (payment_method IN ('pix','card','link')),
  CONSTRAINT payment_transactions_status_chk CHECK (status IN ('pending','approved','rejected','cancelled','refunded','expired'))
);

CREATE INDEX idx_payment_tx_company ON public.payment_transactions(company_id, created_at DESC);
CREATE INDEX idx_payment_tx_customer ON public.payment_transactions(customer_id);
CREATE INDEX idx_payment_tx_status ON public.payment_transactions(company_id, status);
CREATE INDEX idx_payment_tx_mp_payment_id ON public.payment_transactions(mp_payment_id) WHERE mp_payment_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.payment_transactions TO authenticated;
-- Tela pública /pagar/$ref usa server fn admin; não precisa de grant anon.
GRANT ALL ON public.payment_transactions TO service_role;

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view payment_transactions"
  ON public.payment_transactions FOR SELECT TO authenticated
  USING (public.has_company_access(company_id));

CREATE POLICY "members insert payment_transactions"
  ON public.payment_transactions FOR INSERT TO authenticated
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "members update payment_transactions"
  ON public.payment_transactions FOR UPDATE TO authenticated
  USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

CREATE TRIGGER trg_payment_transactions_touch
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Validar customer_id pertence à mesma company (reusa padrão existente)
CREATE TRIGGER trg_payment_tx_validate_customer
  BEFORE INSERT OR UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.cst_validate_customer_company();

-- ============================================================
-- PAYMENT SPLIT LOGS (registro de split executado)
-- ============================================================
CREATE TABLE public.payment_split_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  transaction_id uuid NOT NULL,
  application_fee_cents integer NOT NULL DEFAULT 0,
  owner_amount_cents integer NOT NULL DEFAULT 0,
  total_amount_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ok', -- ok | error
  error text,
  mp_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_split_logs_tx ON public.payment_split_logs(transaction_id);
CREATE INDEX idx_split_logs_company ON public.payment_split_logs(company_id, created_at DESC);

GRANT SELECT ON public.payment_split_logs TO authenticated;
GRANT ALL ON public.payment_split_logs TO service_role;

ALTER TABLE public.payment_split_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view payment_split_logs"
  ON public.payment_split_logs FOR SELECT TO authenticated
  USING (public.has_company_access(company_id));

-- ============================================================
-- WEBHOOK EVENTS (idempotência)
-- ============================================================
CREATE TABLE public.mercado_pago_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mp_event_id text UNIQUE,
  mp_topic text,
  mp_type text,
  mp_action text,
  mp_resource_id text,
  company_id uuid,
  transaction_id uuid,
  status text NOT NULL DEFAULT 'received', -- received | processed | error | duplicate
  error text,
  raw_payload jsonb,
  signature_valid boolean,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX idx_mp_webhook_resource ON public.mercado_pago_webhook_events(mp_resource_id);
CREATE INDEX idx_mp_webhook_company ON public.mercado_pago_webhook_events(company_id, received_at DESC);

GRANT SELECT ON public.mercado_pago_webhook_events TO authenticated;
GRANT ALL ON public.mercado_pago_webhook_events TO service_role;

ALTER TABLE public.mercado_pago_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view mp webhook events"
  ON public.mercado_pago_webhook_events FOR SELECT TO authenticated
  USING (company_id IS NOT NULL AND public.has_company_access(company_id));

CREATE POLICY "super_admin view all mp webhook events"
  ON public.mercado_pago_webhook_events FOR SELECT TO authenticated
  USING (public.is_super_admin());
