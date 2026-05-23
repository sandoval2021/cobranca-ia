import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";
import { SectionPage } from "@/components/ui-premium/SectionPage";

export const Route = createFileRoute("/vencimentos")({
  component: () => (
    <SectionPage
      title="Vencimentos"
      subtitle="Quem vence em breve"
      hint="Lista organizada por proximidade do vencimento."
      icon={CalendarClock}
      emptyTitle="Nenhum vencimento agora"
      emptyDescription="Quando algum cliente estiver perto do vencimento, ele aparece aqui."
    />
  ),
});
