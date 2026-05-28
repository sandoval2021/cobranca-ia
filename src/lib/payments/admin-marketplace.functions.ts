// Painel super_admin do Marketplace Mercado Pago.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function admin() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

async function assertSuperAdmin(userId: string): Promise<boolean> {
  const db = admin();
  const { data } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  return !!data;
}

export type AdminMarketplaceRow = {
  company_id: string;
  company_name: string | null;
  status: string;
  connected_at: string | null;
  approved_count: number;
  pending_count: number;
  volume_cents: number;
  fee_cents: number;
};

export const getAdminMarketplaceOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    if (!(await assertSuperAdmin(userId))) {
      throw new Error("forbidden");
    }
    const db = admin();
    const { data: accounts } = await db
      .from("marketplace_accounts")
      .select("company_id,status,connected_at");
    const { data: companies } = await db.from("companies").select("id,name");
    const { data: txs } = await db
      .from("payment_transactions")
      .select("company_id,status,amount_cents,processing_fee_cents");
    const { data: webhookErrors } = await db
      .from("mercado_pago_webhook_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "error");
    const { data: splitErrors } = await db
      .from("payment_split_logs")
      .select("id", { count: "exact", head: true })
      .eq("status", "error");

    const nameMap = new Map<string, string>(
      (companies || []).map((c: { id: string; name: string }) => [c.id, c.name]),
    );

    const map = new Map<string, AdminMarketplaceRow>();
    for (const a of accounts || []) {
      map.set(a.company_id, {
        company_id: a.company_id,
        company_name: nameMap.get(a.company_id) || null,
        status: a.status,
        connected_at: a.connected_at,
        approved_count: 0,
        pending_count: 0,
        volume_cents: 0,
        fee_cents: 0,
      });
    }
    for (const t of txs || []) {
      const row = map.get(t.company_id);
      if (!row) continue;
      if (t.status === "approved") {
        row.approved_count += 1;
        row.volume_cents += t.amount_cents || 0;
        row.fee_cents += t.processing_fee_cents || 0;
      } else if (t.status === "pending") {
        row.pending_count += 1;
      }
    }

    return {
      rows: Array.from(map.values()).sort((a, b) => b.volume_cents - a.volume_cents),
      webhook_errors:
        (webhookErrors as unknown as { count?: number })?.count ?? 0,
      split_errors: (splitErrors as unknown as { count?: number })?.count ?? 0,
    };
  });
