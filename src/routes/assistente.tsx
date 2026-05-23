import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { SectionPage } from "@/components/ui-premium/SectionPage";

export const Route = createFileRoute("/assistente")({
  component: () => (
    <SectionPage
      title="Assistente"
      subtitle="Ajuda inteligente para o seu dia"
      hint="Sugere ações, responde dúvidas e organiza tarefas."
      icon={Sparkles}
      emptyTitle="Comece uma conversa"
      emptyDescription="Pergunte qualquer coisa sobre seus clientes, cobranças ou números."
      action={{ label: "Conversar" }}
    />
  ),
});
