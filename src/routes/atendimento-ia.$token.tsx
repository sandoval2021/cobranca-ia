import { createFileRoute } from "@tanstack/react-router";
import { AtendimentoIaPanel } from "@/components/ai/AtendimentoIaPanel";

export const Route = createFileRoute("/atendimento-ia/$token")({
  head: () => ({
    meta: [{ title: "Atendimento — CobraEasy" }],
  }),
  component: AtendimentoIaPage,
});

function AtendimentoIaPage() {
  const { token } = Route.useParams();
  return (
    <div className="min-h-screen bg-background">
      <AtendimentoIaPanel token={token} />
    </div>
  );
}
