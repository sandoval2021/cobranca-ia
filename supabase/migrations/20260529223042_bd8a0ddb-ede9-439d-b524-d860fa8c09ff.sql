CREATE OR REPLACE FUNCTION public.requeue_stuck_whatsapp_messages(p_stale_minutes integer DEFAULT 10)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  -- IMPORTANTE: jobs travados em 'sending' podem já ter sido entregues
  -- pelo provedor (Evolution) sem que tenhamos recebido a confirmação.
  -- Reenviar duplicaria a mensagem para o cliente. Por isso, em vez de
  -- recolocar em 'queued', marcamos como 'failed' (terminal) com um
  -- last_error indicando entrega incerta para revisão humana.
  WITH upd AS (
    UPDATE public.whatsapp_message_queue
       SET status     = 'failed',
           locked_at  = NULL,
           locked_by  = NULL,
           failed_at  = now(),
           last_error = COALESCE(last_error,'') || '|send_uncertain_stuck',
           updated_at = now()
     WHERE status = 'sending'
       AND locked_at IS NOT NULL
       AND locked_at < now() - make_interval(mins => GREATEST(1, p_stale_minutes))
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$function$;
