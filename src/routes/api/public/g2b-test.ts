// TEMP — G2B validation only. Delete after use.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/g2b-test")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_HOOK_SECRET || "";
        const u = new URL(request.url);
        const url = `${u.origin}/api/public/hooks/renewal-dispatch`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "x-cobraeasy-cron-secret": secret },
        });
        const body = await res.text();
        return Response.json({
          status: res.status,
          body: body.slice(0, 500),
          secret_present: secret.length > 0,
        });
      },
    },
  },
});
