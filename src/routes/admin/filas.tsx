import { createFileRoute } from "@tanstack/react-router";
import { ListTodo } from "lucide-react";
import { SectionPage } from "@/components/ui-premium/SectionPage";

export const Route = createFileRoute("/admin/filas")({
  component: () => (
    <SectionPage
      title="Filas"
      subtitle="Tarefas aguardando processamento"
      icon={ListTodo}
      emptyTitle="Filas vazias"
      emptyDescription="Tudo processado. Quando houver pendências, aparecem aqui."
    />
  ),
});
