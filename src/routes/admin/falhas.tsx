import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { SectionPage } from "@/components/ui-premium/SectionPage";

export const Route = createFileRoute("/admin/falhas")({
  component: () => (
    <SectionPage
      title="Falhas"
      subtitle="Erros recentes da plataforma"
      icon={AlertTriangle}
      emptyTitle="Nenhuma falha"
      emptyDescription="Quando houver alguma falha, ela aparece aqui com detalhes."
    />
  ),
});
