
ALTER TABLE public.service_message_dispatch_log
  DROP CONSTRAINT IF EXISTS service_message_dispatch_log_status_check;

ALTER TABLE public.service_message_dispatch_log
  ADD CONSTRAINT service_message_dispatch_log_status_check
  CHECK (status IN ('planned','queued','sent','failed','skipped'));

ALTER TABLE public.service_message_dispatch_log
  ADD COLUMN IF NOT EXISTS queue_id uuid;

CREATE INDEX IF NOT EXISTS ix_smdl_queue_id
  ON public.service_message_dispatch_log (queue_id) WHERE queue_id IS NOT NULL;
