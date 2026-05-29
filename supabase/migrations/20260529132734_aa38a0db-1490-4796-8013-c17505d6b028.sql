-- 1) Dedupe forte com company_id
ALTER TABLE public.service_message_dispatch_log
  DROP CONSTRAINT IF EXISTS uq_smdl_customer_msg_cycle;

DROP INDEX IF EXISTS public.uq_smdl_customer_msg_cycle;

CREATE UNIQUE INDEX IF NOT EXISTS uq_smdl_company_customer_msg_cycle
  ON public.service_message_dispatch_log
  (company_id, customer_id, service_plan_message_id, cycle_key);

-- 2) Claim atômico da fila WhatsApp (FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.claim_whatsapp_queue_batch(p_limit integer DEFAULT 25)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  instance_id uuid,
  to_phone text,
  body text,
  attempts integer,
  max_attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT q.id
    FROM public.whatsapp_message_queue q
    WHERE q.status = 'queued'
      AND q.next_attempt_at <= now()
    ORDER BY q.next_attempt_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 25), 200))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.whatsapp_message_queue q
     SET status = 'sending',
         updated_at = now()
    FROM claimed
   WHERE q.id = claimed.id
   RETURNING q.id, q.company_id, q.instance_id, q.to_phone, q.body, q.attempts, q.max_attempts;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_whatsapp_queue_batch(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_queue_batch(integer) TO service_role;