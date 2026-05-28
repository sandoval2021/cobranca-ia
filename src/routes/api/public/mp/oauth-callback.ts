// OAuth callback do Mercado Pago — recebe ?code & ?state, troca por token e salva.
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  exchangeCodeForToken,
  saveMarketplaceAccount,
  verifyState,
} from "@/lib/payments/marketplace.server";

export const Route = createFileRoute("/api/public/mp/oauth-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error) {
          throw redirect({
            to: "/pagamentos/mercado-pago",
            search: { mp: "error", reason: error.slice(0, 40) } as never,
          });
        }
        if (!code || !state) {
          return new Response("Missing code/state", { status: 400 });
        }
        const v = verifyState(state);
        if (!v) return new Response("Invalid state", { status: 400 });

        try {
          const tok = await exchangeCodeForToken(code);
          await saveMarketplaceAccount(v.companyId, tok);
        } catch (e) {
          console.error("[mp oauth] exchange failed", e);
          throw redirect({
            to: "/pagamentos/mercado-pago",
            search: { mp: "error", reason: "exchange_failed" } as never,
          });
        }

        throw redirect({
          to: "/pagamentos/mercado-pago",
          search: { mp: "connected" } as never,
        });
      },
    },
  },
});
