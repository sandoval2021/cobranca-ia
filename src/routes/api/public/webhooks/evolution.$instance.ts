import { createFileRoute } from "@tanstack/react-router";
import {
  handleEvolutionWebhookGet,
  handleEvolutionWebhookPost,
} from "@/lib/whatsapp/evolution-webhook.server";

export const Route = createFileRoute("/api/public/webhooks/evolution/$instance")({
  server: {
    handlers: {
      GET: async ({ request, params }) => handleEvolutionWebhookGet(request, params.instance),
      POST: async ({ request, params }) => handleEvolutionWebhookPost(request, params.instance),
    },
  },
});