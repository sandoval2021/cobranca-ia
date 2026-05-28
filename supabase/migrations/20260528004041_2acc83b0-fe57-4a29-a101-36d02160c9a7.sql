-- Enums
CREATE TYPE public.wa_instance_status AS ENUM
  ('connected','disconnected','awaiting_qr','error','blocked');

CREATE TYPE public.wa_message_status AS ENUM
  ('queued','sending','sent','delivered','read','failed');

CREATE TYPE public.wa_vps_health AS ENUM
  ('healthy','attention','upgrade_recommended','upgrade_urgent');

-- whatsapp_vps_nodes
CREATE TABLE public.whatsapp_vps_nodes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  base_url        text NOT NULL CHECK (base_url ~* '^https?://'),
  api_token_enc   text NOT NULL,
  webhook_secret  text NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  max_instances   integer NOT NULL DEFAULT 50 CHECK (max_instances > 0),
  cpu_pct         numeric(5,2),
  ram_pct         numeric(5,2),
  disk_pct        numeric(5,2),
  uptime_seconds  bigint,
  last_health_at  timestamptz,
  health          public.wa_vps_health NOT NULL DEFAULT 'healthy',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_vps_nodes TO authenticated;
GRANT ALL    ON public.whatsapp_vps_nodes TO service_role;
ALTER TABLE public.whatsapp_vps_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin views vps"
  ON public.whatsapp_vps_nodes FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- whatsapp_instances
CREATE TABLE public.whatsapp_instances (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vps_node_id          uuid NOT NULL REFERENCES public.whatsapp_vps_nodes(id),
  friendly_name        text NOT NULL CHECK (char_length(friendly_name) BETWEEN 1 AND 60),
  provider             text NOT NULL DEFAULT 'evolution'
                       CHECK (provider IN ('evolution')),
  provider_instance_id text NOT NULL,
  status               public.wa_instance_status NOT NULL DEFAULT 'awaiting_qr',
  phone_number         text,
  qr_code              text,
  qr_expires_at        timestamptz,
  last_activity_at     timestamptz,
  daily_sent_count     integer NOT NULL DEFAULT 0 CHECK (daily_sent_count >= 0),
  daily_limit          integer NOT NULL DEFAULT 300 CHECK (daily_limit > 0),
  per_minute_limit     integer NOT NULL DEFAULT 15 CHECK (per_minute_limit > 0),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id),
  UNIQUE (vps_node_id, provider_instance_id)
);
CREATE INDEX idx_wa_inst_company ON public.whatsapp_instances(company_id);
CREATE INDEX idx_wa_inst_node    ON public.whatsapp_instances(vps_node_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_instances TO authenticated;
GRANT ALL ON public.whatsapp_instances TO service_role;
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view company instance"
  ON public.whatsapp_instances FOR SELECT TO authenticated
  USING (public.has_company_access(company_id));

CREATE POLICY "owner inserts company instance"
  ON public.whatsapp_instances FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = whatsapp_instances.company_id AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "members update company instance"
  ON public.whatsapp_instances FOR UPDATE TO authenticated
  USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "owner deletes company instance"
  ON public.whatsapp_instances FOR DELETE TO authenticated
  USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = whatsapp_instances.company_id AND c.owner_id = auth.uid()
    )
  );

-- whatsapp_message_queue
CREATE TABLE public.whatsapp_message_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  instance_id     uuid NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  to_phone        text NOT NULL CHECK (to_phone ~ '^[0-9]{8,20}$'),
  body            text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  status          public.wa_message_status NOT NULL DEFAULT 'queued',
  attempts        integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts    integer NOT NULL DEFAULT 5,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error      text,
  provider_msg_id text,
  scheduled_for   timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_q_company_status ON public.whatsapp_message_queue(company_id, status);
CREATE INDEX idx_wa_q_next ON public.whatsapp_message_queue(next_attempt_at)
  WHERE status IN ('queued','sending');

GRANT SELECT ON public.whatsapp_message_queue TO authenticated;
GRANT ALL    ON public.whatsapp_message_queue TO service_role;
ALTER TABLE public.whatsapp_message_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view company queue"
  ON public.whatsapp_message_queue FOR SELECT TO authenticated
  USING (public.has_company_access(company_id));

-- Trigger: instance.company_id == queue.company_id
CREATE OR REPLACE FUNCTION public.wa_q_validate_instance_company()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.whatsapp_instances i
    WHERE i.id = NEW.instance_id AND i.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'instance % does not belong to company %', NEW.instance_id, NEW.company_id;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.wa_q_validate_instance_company() FROM PUBLIC;

CREATE TRIGGER trg_wa_q_validate
BEFORE INSERT OR UPDATE ON public.whatsapp_message_queue
FOR EACH ROW EXECUTE FUNCTION public.wa_q_validate_instance_company();