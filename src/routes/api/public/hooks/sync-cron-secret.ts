// Sincroniza CRON_HOOK_SECRET do ambiente -> vault.secrets ('cron_hook_secret').
// Não recebe nenhum input do chamador; apenas copia process.env -> vault.
// Idempotente. Nunca loga o valor. Sem risco de exfiltração porque a resposta
// não devolve o segredo.
//
// Uso (1x após cada rotação do CRON_HOOK_SECRET):
//   POST /api/public/hooks/sync-cron-secret

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/hooks/sync-cron-secret")({
  server: {
    handlers: {
      POST: async () => {
        const value = process.env.CRON_HOOK_SECRET || "";
        if (!value) return new Response("not_configured", { status: 500 });

        const { error } = await supabaseAdmin.rpc("set_vault_secret" as any, {
          p_name: "cron_hook_secret",
          p_value: value,
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
