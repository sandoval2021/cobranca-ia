import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Receipt, RefreshCcw, Smartphone, Beaker, Eye, Copy, RotateCcw, Save, X,
  Power, MessageCircle, Mail, Bot, Plus,
} from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { HelpTip } from "@/components/ui-premium/HelpTip";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import {
  listTemplates, upsertTemplate, restoreDefault, restoreAllDefaults,
  previewTemplate, categoryLabel,
  VARIABLES_DEFAULT, VARIABLES_APP, VARIABLES_TESTE,
  type AutoTemplate, type Channel,
} from "@/lib/auto-templates";

export const Route = createFileRoute("/templates-automaticos")({
  component: TemplatesAutomaticosPage,
});

type CatKey = "cobranca" | "renovacao" | "app_cobranca" | "app_renovacao" | "teste";

const CAT_INFO: Record<CatKey, { label: string; hint: string; icon: typeof Receipt }> = {
  cobranca:      { label: "Cobranças",  icon: Receipt,    hint: "Mensagens disparadas antes/no/após o vencimento da fatura." },
  renovacao:     { label: "Renovações", icon: RefreshCcw, hint: "Confirmação automática enviada quando um cliente é renovado." },
  app_cobranca:  { label: "Apps · Cobrança",  icon: Smartphone, hint: "Aviso de vencimento dos aplicativos pagos (Bob, IBO, Vu, etc.)." },
  app_renovacao: { label: "Apps · Renovação", icon: Smartphone, hint: "Confirmação automática quando o app pago é renovado." },
  teste:         { label: "Pessoas em teste", icon: Beaker, hint: "Sequência de mensagens para clientes em período de teste — foco em conversão." },
};

function TemplatesAutomaticosPage() {
  const [templates, setTemplates] = useState<AutoTemplate[]>([]);
  const [tab, setTab] = useState<CatKey>("cobranca");
  const [editing, setEditing] = useState<AutoTemplate | null>(null);
  const [preview, setPreview] = useState<AutoTemplate | null>(null);

  const refresh = () => setTemplates(listTemplates());
  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("cobraeasy:auto-templates-changed", onChange);
    return () => window.removeEventListener("cobraeasy:auto-templates-changed", onChange);
  }, []);

  const byCat = useMemo(() => {
    const buckets: Record<CatKey, AutoTemplate[]> = {
      cobranca: [], renovacao: [], app_cobranca: [], app_renovacao: [], teste: [],
    };
    for (const t of templates) buckets[t.category].push(t);
    buckets.cobranca.sort((a, b) => (a.offsetHours ?? 0) - (b.offsetHours ?? 0));
    buckets.teste.sort((a, b) => (a.offsetHours ?? 0) - (b.offsetHours ?? 0));
    return buckets;
  }, [templates]);

  const toggleActive = (t: AutoTemplate) => {
    upsertTemplate({ ...t, active: !t.active });
    refresh();
  };
  const toggleChannel = (t: AutoTemplate, ch: Channel) => {
    upsertTemplate({ ...t, channels: { ...t.channels, [ch]: !t.channels[ch] } });
    refresh();
  };

  return (
    <PageContainer>
      <SectionHeader
        title="Templates automáticos"
        subtitle="Central de mensagens automáticas: cobrança, renovação, aplicativos e testes."
        hint="Os textos sincronizam entre todos os seus dispositivos. As mensagens são sugeridas/enviadas pelos módulos que já existem (WhatsApp, E-mail e IA)."
        action={
          <Button size="sm" variant="outline" onClick={() => { restoreAllDefaults(); refresh(); toast.success("Tudo restaurado ao padrão."); }}>
            <RotateCcw className="mr-1.5 h-4 w-4" /> Restaurar tudo
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as CatKey)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 h-auto gap-1 bg-muted/40 p-1">
          {(Object.keys(CAT_INFO) as CatKey[]).map((k) => {
            const Icon = CAT_INFO[k].icon;
            return (
              <TabsTrigger key={k} value={k} className="flex flex-col items-center gap-0.5 py-1.5 px-1 text-[11px] leading-tight">
                <Icon className="h-4 w-4" />
                <span className="truncate">{CAT_INFO[k].label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {(Object.keys(CAT_INFO) as CatKey[]).map((k) => (
          <TabsContent key={k} value={k} className="mt-3 space-y-2">
            <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2 text-xs text-muted-foreground">
              <HelpTip text={CAT_INFO[k].hint} />
              <p className="flex-1">{CAT_INFO[k].hint}</p>
            </div>

            {byCat[k].length === 0 && (
              <Card className="p-4 text-center text-sm text-muted-foreground">
                Nenhum template ainda. Clique em "Novo template" abaixo.
              </Card>
            )}

            {byCat[k].map((t) => (
              <TemplateCard
                key={t.id}
                t={t}
                onEdit={() => setEditing(t)}
                onPreview={() => setPreview(t)}
                onToggleActive={() => toggleActive(t)}
                onToggleChannel={(ch) => toggleChannel(t, ch)}
                onCopy={() => { navigator.clipboard.writeText(t.body); toast.success("Texto copiado."); }}
                onRestore={() => { restoreDefault(t.key); refresh(); toast.success("Template restaurado ao padrão."); }}
              />
            ))}

            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setEditing(makeBlank(k))}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Novo template em {CAT_INFO[k].label}
              </Button>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <EditorSheet
        template={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
        onSaved={() => { refresh(); setEditing(null); toast.success("Template salvo."); }}
      />
      <PreviewSheet template={preview} onClose={() => setPreview(null)} />
    </PageContainer>
  );
}

function makeBlank(cat: CatKey): AutoTemplate {
  return {
    id: `custom-${cat}-${Date.now()}`,
    category: cat,
    key: `custom_${cat}_${Date.now()}`,
    name: "Novo template",
    channels: { whatsapp: true, email: false, ia: false },
    active: true,
    body: "",
  };
}

function TemplateCard({
  t, onEdit, onPreview, onToggleActive, onToggleChannel, onCopy, onRestore,
}: {
  t: AutoTemplate;
  onEdit: () => void;
  onPreview: () => void;
  onToggleActive: () => void;
  onToggleChannel: (ch: Channel) => void;
  onCopy: () => void;
  onRestore: () => void;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              t.active ? "bg-emerald-500" : "bg-muted-foreground/40",
            )} />
            <span className="truncate text-sm font-medium">{t.name}</span>
            {t.isDefault && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">padrão</span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {categoryLabel(t.category)}
            {typeof t.offsetHours === "number" && ` · ${formatOffset(t.offsetHours)}`}
          </p>
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={onToggleActive} aria-label="Ativar/desativar">
          <Power className={cn("h-4 w-4", t.active ? "text-emerald-500" : "text-muted-foreground")} />
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <ChannelChip on={t.channels.whatsapp} icon={<MessageCircle className="h-3 w-3" />} label="WhatsApp" onClick={() => onToggleChannel("whatsapp")} />
        <ChannelChip on={t.channels.email}    icon={<Mail className="h-3 w-3" />}          label="E-mail"   onClick={() => onToggleChannel("email")} />
        <ChannelChip on={t.channels.ia}       icon={<Bot className="h-3 w-3" />}           label="IA"        onClick={() => onToggleChannel("ia")} />
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" className="h-8" onClick={onPreview}>
          <Eye className="mr-1 h-3.5 w-3.5" /> Visualizar
        </Button>
        <Button size="sm" variant="outline" className="h-8" onClick={onEdit}>
          Editar
        </Button>
        <Button size="sm" variant="ghost" className="h-8" onClick={onCopy}>
          <Copy className="mr-1 h-3.5 w-3.5" /> Copiar
        </Button>
        {t.isDefault && (
          <Button size="sm" variant="ghost" className="h-8" onClick={onRestore}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restaurar
          </Button>
        )}
      </div>
    </Card>
  );
}

function ChannelChip({
  on, icon, label, onClick,
}: { on: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] transition-colors",
        on
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-border bg-background text-muted-foreground",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function formatOffset(h: number): string {
  if (h === 0) return "No dia (D0)";
  const abs = Math.abs(h);
  if (h < 0) {
    if (abs < 24) return `${abs}h antes`;
    return `${Math.round(abs / 24)} dia(s) antes`;
  }
  if (abs < 24) return `${abs}h depois`;
  return `${Math.round(abs / 24)} dia(s) depois`;
}

function variablesFor(cat: CatKey): readonly string[] {
  if (cat === "app_cobranca" || cat === "app_renovacao") return VARIABLES_APP;
  if (cat === "teste") return VARIABLES_TESTE;
  return VARIABLES_DEFAULT;
}

function EditorSheet({
  template, open, onClose, onSaved,
}: {
  template: AutoTemplate | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<AutoTemplate | null>(template);
  useEffect(() => setDraft(template), [template]);
  if (!draft) return null;

  const vars = variablesFor(draft.category as CatKey);
  const update = <K extends keyof AutoTemplate>(k: K, v: AutoTemplate[K]) =>
    setDraft({ ...draft, [k]: v });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-1.5">
            Editar template
            <HelpTip text="Personalize o título e o texto. Use as variáveis abaixo para incluir nome, valor e vencimento automaticamente." />
          </SheetTitle>
          <SheetDescription>
            Categoria: {categoryLabel(draft.category)}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4 pb-6">
          <div className="space-y-1.5">
            <Label>Nome do template</Label>
            <Input value={draft.name} onChange={(e) => update("name", e.target.value)} />
          </div>

          {(draft.category === "renovacao" || draft.category === "app_cobranca" || draft.category === "app_renovacao") && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                {draft.category === "renovacao" ? "Vincular a um plano (opcional)" : "Vincular a um app (opcional)"}
                <HelpTip text={draft.category === "renovacao"
                  ? "Deixe vazio para usar como padrão de todos os planos. Preencha para criar um texto específico de um plano."
                  : "Deixe vazio para usar para todos os apps. Preencha (ex.: 'IBO Player') para um app específico."} />
              </Label>
              <Input
                placeholder={draft.category === "renovacao" ? "Ex.: Mensal 1 Tela" : "Ex.: IBO Player"}
                value={draft.scope ?? ""}
                onChange={(e) => update("scope", e.target.value || undefined)}
              />
            </div>
          )}

          {(draft.category === "cobranca" || draft.category === "teste") && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  Disparar (horas)
                  <HelpTip text="Negativo = antes do gatilho. Positivo = depois. Para teste, conte a partir do início do teste." />
                </Label>
                <Input
                  type="number"
                  value={draft.offsetHours ?? 0}
                  onChange={(e) => update("offsetHours", parseInt(e.target.value || "0", 10))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Button
                  type="button"
                  className="w-full"
                  variant={draft.active ? "default" : "outline"}
                  onClick={() => update("active", !draft.active)}
                >
                  <Power className="mr-2 h-4 w-4" /> {draft.active ? "Ativo" : "Inativo"}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              Canais de envio
              <HelpTip text="Escolha onde este template pode ser usado." />
            </Label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["whatsapp", "email", "ia"] as Channel[]).map((c) => (
                <Button
                  key={c}
                  type="button"
                  size="sm"
                  variant={draft.channels[c] ? "default" : "outline"}
                  onClick={() => update("channels", { ...draft.channels, [c]: !draft.channels[c] })}
                >
                  {c === "whatsapp" && <MessageCircle className="mr-1 h-3.5 w-3.5" />}
                  {c === "email"    && <Mail className="mr-1 h-3.5 w-3.5" />}
                  {c === "ia"       && <Bot className="mr-1 h-3.5 w-3.5" />}
                  {c === "whatsapp" ? "WhatsApp" : c === "email" ? "E-mail" : "IA"}
                </Button>
              ))}
            </div>
          </div>

          {draft.category === "cobranca" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  Enviar a partir de
                  <HelpTip text="Horário mínimo para sugerir/enviar. Evita madrugada." />
                </Label>
                <Input type="time" value={draft.sendStart ?? "09:00"} onChange={(e) => update("sendStart", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Enviar até</Label>
                <Input type="time" value={draft.sendEnd ?? "20:00"} onChange={(e) => update("sendEnd", e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              Texto da mensagem
              <HelpTip text="Toque numa variável abaixo para inserir no texto." />
            </Label>
            <Textarea rows={9} value={draft.body} onChange={(e) => update("body", e.target.value)} />
            <div className="flex flex-wrap gap-1">
              {vars.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="rounded-md border bg-muted/40 px-1.5 py-0.5 text-[11px] hover:bg-muted"
                  onClick={() => update("body", draft.body + v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Pré-visualização
            </p>
            <pre className="whitespace-pre-wrap text-xs leading-relaxed">
              {previewTemplate(draft.body, previewScope(draft.category))}
            </pre>
          </div>

          <div className="sticky bottom-0 -mx-6 -mb-6 flex gap-2 border-t bg-background px-6 py-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              <X className="mr-2 h-4 w-4" /> Cancelar
            </Button>
            <Button className="flex-1" onClick={() => { upsertTemplate(draft); onSaved(); }}>
              <Save className="mr-2 h-4 w-4" /> Salvar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function previewScope(c: AutoTemplate["category"]): "cobranca" | "renovacao" | "app" | "teste" {
  if (c === "app_cobranca" || c === "app_renovacao") return "app";
  if (c === "teste") return "teste";
  if (c === "renovacao") return "renovacao";
  return "cobranca";
}

function PreviewSheet({ template, onClose }: { template: AutoTemplate | null; onClose: () => void }) {
  if (!template) return null;
  return (
    <Sheet open={!!template} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{template.name}</SheetTitle>
          <SheetDescription>{categoryLabel(template.category)} — exemplo com dados fictícios.</SheetDescription>
        </SheetHeader>
        <div className="mt-3 rounded-lg border bg-muted/30 p-3">
          <pre className="whitespace-pre-wrap text-sm leading-relaxed">
            {previewTemplate(template.body, previewScope(template.category))}
          </pre>
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => {
            navigator.clipboard.writeText(previewTemplate(template.body, previewScope(template.category)));
            toast.success("Exemplo copiado.");
          }}>
            <Copy className="mr-2 h-4 w-4" /> Copiar exemplo
          </Button>
          <Button className="flex-1" onClick={onClose}>Fechar</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
