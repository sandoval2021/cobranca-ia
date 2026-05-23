import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { SectionPage } from "@/components/ui-premium/SectionPage";

export const Route = createFileRoute("/whatsapp")({
  component: () => (
    <SectionPage
      title="WhatsApp"
      subtitle="Mensagens automáticas para seus clientes"
      hint="Os lembretes e cobranças são enviados pelo WhatsApp."
      icon={MessageCircle}
      emptyTitle="Nenhuma conversa ainda"
      emptyDescription="Assim que houver troca de mensagens, elas aparecem aqui."
    />
  ),
});
