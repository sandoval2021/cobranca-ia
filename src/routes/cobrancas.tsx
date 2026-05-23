import { createFileRoute } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import { SectionPage } from "@/components/ui-premium/SectionPage";

export const Route = createFileRoute("/cobrancas")({
  component: () => (
    <SectionPage
      title="Cobranças"
      subtitle="Tudo que foi enviado e recebido"
      hint="Você acompanha aqui o status de cada cobrança."
      icon={Receipt}
      emptyTitle="Sem cobranças por aqui"
      emptyDescription="Crie uma cobrança ou aguarde o próximo vencimento."
      action={{ label: "Nova cobrança" }}
    />
  ),
});
