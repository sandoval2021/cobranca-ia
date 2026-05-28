CREATE TYPE public.otp_purpose AS ENUM ('signup', 'login', 'recovery');

CREATE TABLE public.auth_email_otps (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized      TEXT NOT NULL,
  otp_hash              TEXT NOT NULL,
  purpose               public.otp_purpose NOT NULL,
  attempts              INT  NOT NULL DEFAULT 0,
  max_attempts          INT  NOT NULL DEFAULT 5,
  expires_at            TIMESTAMPTZ NOT NULL,
  consumed_at           TIMESTAMPTZ,
  resend_available_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_auth_email_otps_attempts
    CHECK (attempts >= 0 AND attempts <= 100),
  CONSTRAINT chk_auth_email_otps_max_attempts
    CHECK (max_attempts >= 1 AND max_attempts <= 20)
);

CREATE INDEX idx_auth_email_otps_lookup
  ON public.auth_email_otps (email_normalized, purpose)
  WHERE consumed_at IS NULL;

CREATE INDEX idx_auth_email_otps_expires
  ON public.auth_email_otps (expires_at)
  WHERE consumed_at IS NULL;

CREATE UNIQUE INDEX uq_auth_email_otps_active
  ON public.auth_email_otps (email_normalized, purpose)
  WHERE consumed_at IS NULL;

REVOKE ALL ON public.auth_email_otps FROM anon, authenticated;
GRANT ALL ON public.auth_email_otps TO service_role;
ALTER TABLE public.auth_email_otps ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.auth_pending_signups (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized  TEXT NOT NULL,
  password_hash     TEXT NOT NULL,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_signups_email
  ON public.auth_pending_signups (email_normalized);

CREATE INDEX idx_pending_signups_expires
  ON public.auth_pending_signups (expires_at);

REVOKE ALL ON public.auth_pending_signups FROM anon, authenticated;
GRANT ALL ON public.auth_pending_signups TO service_role;
ALTER TABLE public.auth_pending_signups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.auth_login_locks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized  TEXT NOT NULL,
  ip                TEXT NOT NULL,
  failed_attempts   INT  NOT NULL DEFAULT 0,
  locked_until      TIMESTAMPTZ,
  last_failed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email_normalized, ip)
);

CREATE INDEX idx_auth_login_locks_locked_until
  ON public.auth_login_locks (locked_until)
  WHERE locked_until IS NOT NULL;

REVOKE ALL ON public.auth_login_locks FROM anon, authenticated;
GRANT ALL ON public.auth_login_locks TO service_role;
ALTER TABLE public.auth_login_locks ENABLE ROW LEVEL SECURITY;

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.cleanup_auth_ephemeral()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET timezone TO 'UTC'
AS $$
BEGIN
  DELETE FROM public.auth_email_otps
   WHERE expires_at < now()
      OR (consumed_at IS NOT NULL AND consumed_at < now() - INTERVAL '1 hour');

  DELETE FROM public.auth_pending_signups
   WHERE expires_at < now();

  DELETE FROM public.auth_login_locks
   WHERE locked_until IS NOT NULL
     AND locked_until < now() - INTERVAL '1 hour';
END;
$$;

SELECT cron.schedule(
  'cleanup-auth-ephemeral',
  '*/10 * * * *',
  $$ SELECT public.cleanup_auth_ephemeral(); $$
);