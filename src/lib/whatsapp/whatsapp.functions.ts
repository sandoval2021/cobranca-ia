// Server functions WhatsApp — multi-tenant, owner/admin only.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  evolutionProvider,
  loadInstanceRef,
  pickAvailableVps,
  getEvolutionWebhookUrl,
} from "./evolution.server";

async function assertCompanyAccess(
  supabase: any,
  userId: string,
  companyId: string,
): Promise<void> {
  // owner ou membro da empresa
  const { data: owner } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (owner) return;

  const { data: member } = await supabase
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) throw new Error("forbidden");
  if (!["owner", "admin"].includes(String(member.role))) throw new Error("forbidden");
}

// -------- connect / create --------
export const connectWhatsAppInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        company_id: z.string().uuid(),
        friendly_name: z.string().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCompanyAccess(supabase, userId, data.company_id);

    // Já existe instância para a empresa?
    const { data: existing } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("id, status")
      .eq("company_id", data.company_id)
      .maybeSingle();

    if (existing) {
      const ref = await loadInstanceRef(existing.id);
      if (!ref) throw new Error("instance_ref_missing");
      const qr = await evolutionProvider.getQrCode(ref);
      await supabaseAdmin
        .from("whatsapp_instances")
        .update({
          status: qr.status,
          qr_code: qr.qr_code,
          qr_expires_at: qr.qr_expires_at,
        })
        .eq("id", existing.id);
      return { instance_id: existing.id, status: qr.status, qr_code: qr.qr_code };
    }

    const vps = await pickAvailableVps();
    if (!vps) throw new Error("no_vps_available");

    // Cria placeholder para obter ID e montar webhook URL
    const { data: created, error: ce } = await supabaseAdmin
      .from("whatsapp_instances")
      .insert({
        company_id: data.company_id,
        vps_node_id: vps.id,
        friendly_name: data.friendly_name,
        provider: "evolution",
        provider_instance_id: `pending_${Date.now()}`,
        status: "awaiting_qr",
      })
      .select("id")
      .single();
    if (ce || !created) throw new Error(ce?.message || "create_failed");

    const { data: vpsRow } = await supabaseAdmin
      .from("whatsapp_vps_nodes")
      .select("id, base_url, api_token_enc, webhook_secret")
      .eq("id", vps.id)
      .single();
    if (!vpsRow) throw new Error("vps_missing");

    const res = await evolutionProvider.createInstance({
      vps: {
        id: vpsRow.id,
        base_url: vpsRow.base_url,
        api_token: vpsRow.api_token_enc,
        webhook_secret: vpsRow.webhook_secret,
      },
      friendly_name: data.friendly_name,
      webhook_url: getEvolutionWebhookUrl(created.id),
    });

    await supabaseAdmin
      .from("whatsapp_instances")
      .update({
        provider_instance_id: res.provider_instance_id,
        qr_code: res.qr_code,
        qr_expires_at: res.qr_expires_at,
        status: res.status,
      })
      .eq("id", created.id);

    return { instance_id: created.id, status: res.status, qr_code: res.qr_code };
  });

// -------- getQr --------
export const getWhatsAppQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ instance_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ref = await loadInstanceRef(data.instance_id);
    if (!ref) throw new Error("not_found");
    await assertCompanyAccess(supabase, userId, ref.company_id);

    const qr = await evolutionProvider.getQrCode(ref);
    await supabaseAdmin
      .from("whatsapp_instances")
      .update({
        qr_code: qr.qr_code,
        qr_expires_at: qr.qr_expires_at,
        status: qr.status,
      })
      .eq("id", ref.id);
    return qr;
  });

// -------- disconnect --------
export const disconnectWhatsAppInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ instance_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ref = await loadInstanceRef(data.instance_id);
    if (!ref) throw new Error("not_found");
    await assertCompanyAccess(supabase, userId, ref.company_id);

    const status = await evolutionProvider.disconnect(ref);
    await supabaseAdmin
      .from("whatsapp_instances")
      .update({ status, qr_code: null, qr_expires_at: null })
      .eq("id", ref.id);
    return { status };
  });

// -------- enqueue --------
export const enqueueWhatsAppMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        instance_id: z.string().uuid(),
        to_phone: z.string().min(8).max(20).regex(/^\+?[0-9]+$/),
        body: z.string().min(1).max(4000),
        scheduled_for: z.string().datetime().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ref = await loadInstanceRef(data.instance_id);
    if (!ref) throw new Error("not_found");
    await assertCompanyAccess(supabase, userId, ref.company_id);

    const { data: row, error } = await supabaseAdmin
      .from("whatsapp_message_queue")
      .insert({
        company_id: ref.company_id,
        instance_id: ref.id,
        to_phone: data.to_phone,
        body: data.body,
        status: "queued",
        scheduled_for: data.scheduled_for ?? new Date().toISOString(),
        next_attempt_at: data.scheduled_for ?? new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { queue_id: row!.id };
  });

// -------- listInstanceByCompany (UI dono) --------
export const getCompanyWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ company_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCompanyAccess(supabase, userId, data.company_id);

    const { data: inst } = await supabaseAdmin
      .from("whatsapp_instances")
      .select(
        "id, friendly_name, status, phone_number, qr_code, qr_expires_at, daily_limit, daily_sent_count, per_minute_limit, last_activity_at",
      )
      .eq("company_id", data.company_id)
      .maybeSingle();

    if (!inst) return { instance: null, queued: 0 };

    const { count: queued } = await supabaseAdmin
      .from("whatsapp_message_queue")
      .select("id", { count: "exact", head: true })
      .eq("instance_id", inst.id)
      .in("status", ["queued", "sending"]);

    return { instance: inst, queued: queued ?? 0 };
  });

// -------- super admin: lista VPS --------
export const listVpsNodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isSuper } = await supabase.rpc("is_super_admin");
    if (!isSuper) throw new Error("forbidden");

    const { data: nodes } = await supabaseAdmin
      .from("whatsapp_vps_nodes")
      .select(
        "id, name, base_url, health, cpu_pct, ram_pct, disk_pct, uptime_seconds, max_instances, is_active, last_health_at",
      )
      .order("created_at", { ascending: true });

    const withCounts = await Promise.all(
      (nodes ?? []).map(async (n) => {
        const { count: instCount } = await supabaseAdmin
          .from("whatsapp_instances")
          .select("id", { count: "exact", head: true })
          .eq("vps_node_id", n.id);
        return { ...n, instance_count: instCount ?? 0 };
      }),
    );

    const { count: queueTotal } = await supabaseAdmin
      .from("whatsapp_message_queue")
      .select("id", { count: "exact", head: true })
      .in("status", ["queued", "sending"]);

    const { count: errorsTotal } = await supabaseAdmin
      .from("whatsapp_message_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed");

    return { nodes: withCounts, queueTotal: queueTotal ?? 0, errorsTotal: errorsTotal ?? 0 };
  });
