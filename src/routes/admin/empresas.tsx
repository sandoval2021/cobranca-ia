import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { SectionPage } from "@/components/ui-premium/SectionPage";

export const Route = createFileRoute("/admin/empresas")({
  component: () => (
    <SectionPage
      title="Empresas"
      subtitle="Todas as empresas da plataforma"
      icon={Building2}
      emptyTitle="Sem empresas para mostrar"
      emptyDescription="Quando uma empresa for criada, ela aparece aqui."
    />
  ),
});
