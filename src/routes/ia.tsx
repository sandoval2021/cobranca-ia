import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Lock } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { EmptyState } from "@/components/ui-premium/EmptyState";
import { ListCardSkeleton } from "@/components/ui-premium/Skeletons";
import { Button } from "@/components/ui/button";
import { useSupabaseList } from "@/lib/use-supabase";
import { flags, STAGING_BLOCK_MESSAGE } from "@/lib/flags";
import { toast } from "sonner";

export const Route = createFileRoute("/ia")({ component: IaPage });

type Row = Record<string, unknown>;
const str = (r: Row, keys: string[]) => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
};

function IaPage() {
  const state = useSupabaseList<Row>("ai_messages", {
    limit: 100,
    order: { column: "created_at", ascending: false },
  });
  const blocked = () => toast.message(STAGING_BLOCK_MESSAGE);

  return (
    <PageContainer>
      <SectionHeader
        title="IA Cobrança"
        subtitle="Modo de testes — geração real bloqueada"
        hint="As mensagens abaixo são demonstrativas."
        action={
          <Button size="sm" disabled={!flags.allowRealAi} onClick={blocked} className="gap-1">
            <Lock className="h-3.5 w-3.5" /> Gerar com IA
          </Button>
        }
      />
      {flags.stagingMode && (
        <div className="mb-3 rounded-xl border border-primary/30 bg-primary-soft px-3 py-2 text-xs text-primary">
          Ambiente de testes: a geração real com IA está bloqueada.
        </div>
      )}
      {state.status === "loading" && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <ListCardSkeleton key={i} />
          ))}
        </div>
      )}
      {state.status === "not_configured" && (
        <EmptyState icon={Sparkles} title="Conexão não configurada" description="Defina as variáveis de ambiente do Supabase." />
      )}
      {state.status === "error" && (
        <EmptyState icon={Sparkles} title="Não foi possível carregar" description={state.message} />
      )}
      {state.status === "ready" && state.data.length === 0 && (
        <EmptyState icon={Sparkles} title="Sem mensagens da IA" description="As respostas da IA aparecem aqui." />
      )}
      {state.status === "ready" && state.data.length > 0 && (
        <div className="space-y-2">
          {state.data.map((row, i) => {
            const body = str(row, ["content", "response", "text", "message", "body"]) ?? "(sem conteúdo)";
            const role = str(row, ["role", "type"]) ?? "ia";
            return (
              <div
                key={(row.id as string) ?? i}
                className="rounded-xl border border-border bg-card p-3 shadow-card"
              >
                <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span>{role}</span>
                </div>
                <p className="text-sm leading-snug">{body}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" disabled={!flags.allowRealAi} onClick={blocked}>
                    Responder com IA
                  </Button>
                  <Button size="sm" variant="ghost" disabled={!flags.allowRealWhatsapp} onClick={blocked}>
                    Cobrar agora
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
