-- Temporary probe to validate hook auth end-to-end against PREVIEW URL.
-- Returns only an http request id; never returns the secret.
CREATE OR REPLACE FUNCTION public._probe_cron_hook(p_url text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE v_req bigint; v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name='cron_hook_secret';
  IF v_secret IS NULL THEN RAISE EXCEPTION 'no_secret'; END IF;
  SELECT net.http_post(
    url := p_url,
    headers := jsonb_build_object('Content-Type','application/json','x-cobraeasy-cron-secret', v_secret),
    body := '{}'::jsonb
  ) INTO v_req;
  RETURN v_req;
END $$;
REVOKE ALL ON FUNCTION public._probe_cron_hook(text) FROM PUBLIC, anon, authenticated;