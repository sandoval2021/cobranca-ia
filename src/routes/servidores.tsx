import { createFileRoute } from "@tanstack/react-router";
import { Server } from "lucide-react";
import { SectionPage } from "@/components/ui-premium/SectionPage";

export const Route = createFileRoute("/servidores")({
  component: () => (
    <SectionPage
      title="Servidores"
      subtitle="Seus servidores cadastrados"
      hint="Cada servidor pode ter uma cor para identificar rápido."
      icon={Server}
      emptyTitle="Nenhum servidor"
      emptyDescription="Cadastre um servidor para começar a vincular seus clientes."
      action={{ label: "Adicionar servidor" }}
    />
  ),
});
