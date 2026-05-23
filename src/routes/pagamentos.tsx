import { createFileRoute } from "@tanstack/react-router";
import { CreditCard } from "lucide-react";
import { SectionPage } from "@/components/ui-premium/SectionPage";

export const Route = createFileRoute("/pagamentos")({
  component: () => (
    <SectionPage
      title="Pagamentos"
      subtitle="Pagamentos recebidos dos seus clientes"
      hint="Cada pagamento confirmado aparece aqui automaticamente."
      icon={CreditCard}
      emptyTitle="Nenhum pagamento ainda"
      emptyDescription="Quando seus clientes pagarem, você verá tudo aqui."
    />
  ),
});
