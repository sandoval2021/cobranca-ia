import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  BookOpen,
  Search,
  Download,
  HelpCircle,
  ArrowRight,
  Info,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLocalAuth } from "@/lib/use-local-auth";
import {
  HELP_ARTICLES,
  HELP_CATEGORY_LABEL,
  HELP_FAQ,
  HELP_FLOWS,
  exportHelpManualTxt,
  searchHelpArticles,
  type HelpArticle,
  type HelpCategory,
} from "@/lib/help-center";

export const Route = createFileRoute("/ajuda")({
  component: AjudaPage,
  head: () => ({
    meta: [
      { title: "Ajuda — CobraEasy" },
      {
        name: "description",
        content: "Central local de ajuda. Aprenda como usar cada parte do sistema.",
      },
    ],
  }),
});

// Categorias que só fazem sentido para super_admin — escondidas do Dono.
const ADMIN_ONLY_CATEGORIES: HelpCategory[] = ["dns_rotas", "backend_futuro"];

type ChipKey = "todos" | HelpCategory;


const ALL_CHIPS: { key: ChipKey; label: string }[] = [
  { key: "todos", label: "Todos" },
  ...(Object.keys(HELP_CATEGORY_LABEL) as HelpCategory[]).map((k) => ({
    key: k as ChipKey,
    label: HELP_CATEGORY_LABEL[k],
  })),
];

function ArticleCard({ a }: { a: HelpArticle }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {HELP_CATEGORY_LABEL[a.categoria]}
          </p>
          <h3 className="text-base font-semibold leading-snug">{a.titulo}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{a.resumo}</p>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-1.5 rounded-lg bg-surface-muted p-3 text-sm">
          {a.conteudo.map((c, i) => (
            <p key={i} className="leading-relaxed">
              {c}
            </p>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? "Ocultar" : "Ler mais"}
        </Button>
        {a.link && (
          <Button asChild size="sm">
            <Link to={a.link}>
              Abrir módulo
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function AjudaPage() {
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<ChipKey>("todos");
  const { isSuperAdmin } = useLocalAuth();

  const visibleArticles = useMemo(
    () =>
      isSuperAdmin
        ? HELP_ARTICLES
        : HELP_ARTICLES.filter((a) => !ADMIN_ONLY_CATEGORIES.includes(a.categoria)),
    [isSuperAdmin],
  );

  const CHIPS = useMemo(
    () =>
      isSuperAdmin
        ? ALL_CHIPS
        : ALL_CHIPS.filter(
            (c) => c.key === "todos" || !ADMIN_ONLY_CATEGORIES.includes(c.key as HelpCategory),
          ),
    [isSuperAdmin],
  );

  const articles = useMemo(() => {
    const base = searchHelpArticles(query).filter((a) =>
      visibleArticles.some((v) => v.id === a.id),
    );
    if (chip === "todos") return base;
    return base.filter((a) => a.categoria === chip);
  }, [query, chip, visibleArticles]);

  const starters = visibleArticles
    .filter((a) => a.categoria === "primeiros_passos" || a.prioridade === "alta")
    .slice(0, 4);

  return (
    <PageContainer>
      <SectionHeader
        title="Ajuda"
        subtitle="Aprenda como usar cada parte do sistema."
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-surface-muted p-3 text-xs">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <p>
          <span className="font-semibold">Central local de ajuda.</span> Nenhuma
          informação será enviada para fora do navegador.
        </p>
      </div>

      {/* Busca + exportar */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar artigo, dúvida ou módulo..."
            className="h-11 pl-9 text-base"
          />
        </div>
        <Button onClick={() => exportHelpManualTxt()} variant="outline" className="h-11">
          <Download className="mr-2 h-4 w-4" />
          Exportar manual
        </Button>
      </div>

      {/* Filtros */}
      <div className="mb-5 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {CHIPS.map((c) => {
          const active = chip === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setChip(c.key)}
              className={cn(
                "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-card hover:bg-surface-muted",
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Comece por aqui */}
      {chip === "todos" && !query && (
        <div className="mb-6">
          <SectionHeader
            title="Comece por aqui"
            subtitle="Artigos essenciais para os primeiros passos"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {starters.map((a) => (
              <ArticleCard key={a.id} a={a} />
            ))}
          </div>
        </div>
      )}

      {/* Artigos */}
      <div className="mb-6">
        <SectionHeader
          title={query ? `Resultados (${articles.length})` : "Todos os artigos"}
          subtitle={query ? `Busca: "${query}"` : "Lista completa por categoria"}
        />
        {articles.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-card">
            <BookOpen className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            Nenhum artigo encontrado.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {articles.map((a) => (
              <ArticleCard key={a.id} a={a} />
            ))}
          </div>
        )}
      </div>

      {/* Fluxos recomendados */}
      <div className="mb-6">
        <SectionHeader
          title="Fluxos recomendados"
          subtitle="Passo a passo para situações comuns"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {HELP_FLOWS.map((f) => (
            <div
              key={f.id}
              className="rounded-2xl border border-border bg-card p-4 shadow-card"
            >
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <h3 className="text-base font-semibold leading-snug">{f.titulo}</h3>
                  <p className="text-sm text-muted-foreground">{f.descricao}</p>
                </div>
              </div>
              <ol className="mt-3 space-y-1.5">
                {f.passos.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 rounded-lg bg-surface-muted px-2 py-1.5 text-sm"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate">{p.label}</span>
                    {p.link && (
                      <Link
                        to={p.link}
                        className="inline-flex items-center text-xs text-primary hover:underline"
                      >
                        Abrir
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="mb-6">
        <SectionHeader
          title="Dúvidas frequentes"
          subtitle="Respostas rápidas para as principais perguntas"
        />
        <div className="space-y-2">
          {HELP_FAQ.map((f) => (
            <details
              key={f.id}
              className="group rounded-xl border border-border bg-card p-3 shadow-card"
            >
              <summary className="flex cursor-pointer items-start gap-2 text-sm font-medium">
                <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1">{f.pergunta}</span>
              </summary>
              <p className="mt-2 pl-6 text-sm text-muted-foreground">{f.resposta}</p>
            </details>
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        Central de ajuda local. Atualizada manualmente conforme o sistema evolui.
      </p>
    </PageContainer>
  );
}
