
-- Garante que existe um vault secret 'cron_hook_secret' (placeholder se necessário).
-- O valor real deve ser populado pelo dono via:
--   SELECT vault.update_secret(
--     (SELECT id FROM vault.secrets WHERE name='cron_hook_secret'),
--     '<valor do CRON_HOOK_SECRET>'
--   );
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'cron_hook_secret') THEN
    PERFORM vault.create_secret('REPLACE_ME', 'cron_hook_secret');
  END IF;
END $$;

-- Remove cron antigo do wa-dispatch que usava apikey.
SELECT cron.unschedule('wa-dispatch-minute');

-- Reagenda wa-dispatch usando x-cobraeasy-cron-secret do vault.
SELECT cron.schedule(
  'wa-dispatch-minute',
  '* * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://project--d41959a8-9c27-4d26-8c78-a6dc4f4a0793.lovable.app/api/public/hooks/wa-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cobraeasy-cron-secret', (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'cron_hook_secret'
      )
    ),
    body := '{}'::jsonb
  );
  $job$
);

-- Cria cron diário para services-dispatch (motor de mensagens por plano).
-- Executa 1x/dia às 09:00 UTC (~06:00 BRT).
SELECT cron.schedule(
  'services-dispatch-daily',
  '0 9 * * *',
  $job$
  SELECT net.http_post(
    url := 'https://project--d41959a8-9c27-4d26-8c78-a6dc4f4a0793.lovable.app/api/public/hooks/services-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cobraeasy-cron-secret', (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'cron_hook_secret'
      )
    ),
    body := '{}'::jsonb
  );
  $job$
);
