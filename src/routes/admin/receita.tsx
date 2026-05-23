import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp } from "lucide-react";
import { SectionPage } from "@/components/ui-premium/SectionPage";

export const Route = createFileRoute("/admin/receita")({
  component: () => (
    <SectionPage
      title="Receita"
      subtitle="Faturamento por empresa e plano"
      icon={TrendingUp}
      emptyTitle="Sem receita registrada"
      emptyDescription="Os números aparecem assim que houver pagamentos."
    />
  ),
});
