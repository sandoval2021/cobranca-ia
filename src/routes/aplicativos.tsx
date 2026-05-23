import { createFileRoute } from "@tanstack/react-router";
import { AppWindow } from "lucide-react";
import { SectionPage } from "@/components/ui-premium/SectionPage";

export const Route = createFileRoute("/aplicativos")({
  component: () => (
    <SectionPage
      title="Aplicativos"
      subtitle="Aplicativos disponíveis para os clientes"
      hint="Você pode dar uma cor a cada aplicativo para identificar fácil."
      icon={AppWindow}
      emptyTitle="Nenhum aplicativo cadastrado"
      emptyDescription="Cadastre um aplicativo para vincular aos planos."
      action={{ label: "Adicionar aplicativo" }}
    />
  ),
});
