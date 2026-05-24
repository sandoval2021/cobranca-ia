import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Lock } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { EmptyState } from "@/components/ui-premium/EmptyState";
import { ListCardSkeleton } from "@/components/ui-premium/Skeletons";
import { Button } from "@/components/ui/button";
import { useSupabaseList } from "@/lib/use-supabase";
import { flags, STAGING_BLOCK_MESSAGE } from "@/lib/flags";
import { toast } from "sonner";

export const Route = createFileRoute("/mensagens")({ component: MensagensPage });

type Row = Record<string, unknown>;
const str = (r: Row, keys: string[]) => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
};
const fmtWhen = (s: string | null) => {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(+d) ? s : d.toLocaleString("pt-BR");
};

function MensagensPage() {
  const state = useSupabaseList<Row>("messages", {
    limit: 100,
    order: { column: "created_at", ascending: false },
  });
  const blocked = () => toast.message(STAGING_BLOCK_MESSAGE);

  return (
    <PageContainer>
      <SectionHeader
        title="Mensagens"
        subtitle="Conversas e envios demonstrativos"
        action={
          <Button size="sm" disabled={!flags.allowRealWhatsapp} onClick={blocked} className="gap-1">
            <Lock className="h-3.5 w-3.5" /> Enviar
          </Button>
        }
      />
      {state.status === "loading" && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <ListCardSkeleton key={i} />
          ))}
        </div>
      )}
      {state.status === "not_configured" && (
        <EmptyState icon={MessageCircle} title="Conexão não configurada" description="Defina as variáveis de ambiente do Supabase." />
      )}
      {state.status === "error" && (
        <EmptyState icon={MessageCircle} title="Não foi possível carregar" description={state.message} />
      )}
      {state.status === "ready" && state.data.length === 0 && (
        <EmptyState icon={MessageCircle} title="Sem mensagens demo" description="Assim que houver mensagens, elas aparecem aqui." />
      )}
      {state.status === "ready" && state.data.length > 0 && (
        <div className="space-y-2">
          {state.data.map((row, i) => {
            const body = str(row, ["content", "body", "text", "message"]) ?? "(sem conteúdo)";
            const dir = str(row, ["direction", "type", "kind"]);
            const status = str(row, ["status"]);
            const when = fmtWhen(str(row, ["created_at", "sent_at", "updated_at"]));
            return (
              <div
                key={(row.id as string) ?? i}
                className="rounded-xl border border-border bg-card p-3 shadow-card"
              >
                <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <MessageCircle className="h-3 w-3 text-success" />
                  <span className="truncate">
                    {[dir, status].filter(Boolean).join(" · ") || "mensagem"}
                  </span>
                  {when && <span className="ml-auto shrink-0">{when}</span>}
                </div>
                <p className="text-sm leading-snug">{body}</p>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
