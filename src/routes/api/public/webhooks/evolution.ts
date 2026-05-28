import { createFileRoute } from "@tanstack/react-router";
import {
  handleEvolutionWebhookGet,
  handleEvolutionWebhookPost,
} from "@/lib/whatsapp/evolution-webhook.server";

export const Route = createFileRoute("/api/public/webhooks/evolution")({
  server: {
    handlers: {
      GET: async ({ request }) => handleEvolutionWebhookGet(request),
      POST: async ({ request }) => handleEvolutionWebhookPost(request),
    },
  },
});