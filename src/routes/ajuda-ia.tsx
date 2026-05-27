import { createFileRoute } from "@tanstack/react-router";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { AjudaIaPanel } from "@/components/ai/AjudaIaPanel";

export const Route = createFileRoute("/ajuda-ia")({
  head: () => ({
    meta: [{ title: "Ajuda com IA — CobraEasy" }],
  }),
  component: AjudaIaPage,
});

function AjudaIaPage() {
  return (
    <PageContainer>
      <SectionHeader
        title="Ajuda com IA"
        subtitle="Tire dúvidas sobre como usar o CobraEasy"
      />
      <AjudaIaPanel />
    </PageContainer>
  );
}
