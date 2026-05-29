// Sincroniza CRON_HOOK_SECRET do ambiente -> vault.secrets ('cron_hook_secret').
// Protegido pelo próprio CRON_HOOK_SECRET via header x-cobraeasy-cron-secret.
// Idempotente: pode ser chamado quantas vezes for necessário; o vault sempre
// fica espelhando o valor do env. Nunca loga o valor.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/hooks/sync-cron-secret")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.CRON_HOOK_SECRET || "";
        if (!expected) {
          return new Response("not_configured", { status: 500 });
        }
        const provided = request.headers.get("x-cobraeasy-cron-secret") || "";
        if (!provided || !timingSafeEq(provided, expected)) {
          return new Response("unauthorized", { status: 401 });
        }

        const { error } = await supabaseAdmin.rpc("set_vault_secret" as any, {
          p_name: "cron_hook_secret",
          p_value: expected,
        });
        if (error) {
          console.error("[sync-cron-secret] failed:", error.message);
          return new Response("sync_failed", { status: 500 });
        }
        return Response.json({ ok: true, name: "cron_hook_secret" });
      },
    },
  },
});
