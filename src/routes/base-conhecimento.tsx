import { createFileRoute, Link } from "@tanstack/react-router";
import { applyRevendaVariables } from "@/lib/revenda-settings";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen, Plus, Pencil, Trash2, Download, Upload, RotateCcw,
  Search, X, Save, MessageSquare, AlertCircle, UserCog, Sparkles,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { EmptyState } from "@/components/ui-premium/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  KBCategory, KB_CATEGORY_LABEL, KBEntry,
  readAll, writeAll, upsert, remove, newId, buildDefaults,
  simulate, buildBackup, parseBackup, restoreDefaults, mergeEntries,
} from "@/lib/knowledge-base";
import { APP_OPTIONS, APP_CATALOG } from "@/lib/app-screens";

export const Route = createFileRoute("/base-conhecimento")({
  component: BaseConhecimentoPage,
});

const CATS: KBCategory[] = ["saudacao", "regra", "problema", "app", "audio_foto", "humano"];

function todayStamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function BaseConhecimentoPage() {
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<KBCategory | "all">("all");
  const [editing, setEditing] = useState<KBEntry | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<KBEntry | null>(null);
  const [importPreview, setImportPreview] = useState<KBEntry[] | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const refresh = () => setEntries(readAll());

  useEffect(() => {
    let list = readAll();
    if (list.length === 0) {
      list = buildDefaults();
      writeAll(list);
    }
    setEntries(list);
    const on = () => refresh();
    window.addEventListener("kb:changed", on);
    return () => window.removeEventListener("kb:changed", on);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (cat !== "all" && e.category !== cat) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.short.toLowerCase().includes(q) ||
        e.full.toLowerCase().includes(q) ||
        e.keywords.some((k) => k.includes(q))
      );
    });
  }, [entries, search, cat]);

  const countsByCat = useMemo(() => {
    const map: Record<string, number> = { all: entries.length };
    for (const c of CATS) map[c] = entries.filter((e) => e.category === c).length;
    return map;
  }, [entries]);

  const openNew = () => { setEditing(null); setSheetOpen(true); };
  const openEdit = (e: KBEntry) => { setEditing(e); setSheetOpen(true); };

  const handleExport = () => {
    const data = buildBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `base-conhecimento-ia-cobranca-ia-${todayStamp()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success("Base exportada");
  };

  const onFile = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (!f) return;
    try {
      const r = parseBackup(await f.text());
      if (!r.ok) { toast.error("Arquivo inválido"); return; }
      setImportPreview(r.entries);
    } catch { toast.error("Não foi possível ler o arquivo"); }
  };

  const doRestore = () => { restoreDefaults(); setConfirmReset(false); toast.success("Base restaurada para o padrão"); };
  const doDelete = () => { if (confirmDelete) { remove(confirmDelete.id); setConfirmDelete(null); toast.success("Item removido"); } };
  const doMerge = () => { if (importPreview) { mergeEntries(importPreview); setImportPreview(null); toast.success("Base mesclada"); } };
  const doReplace = () => { if (importPreview) { writeAll(importPreview); setImportPreview(null); toast.success("Base substituída"); } };

  return (
    <PageContainer>
      <SectionHeader
        title="Base da IA"
        subtitle="Cadastre respostas e regras para treinar o atendimento automático no futuro."
      />

      <div className="rounded-md border border-amber-300/40 bg-amber-50/40 p-2 text-[11px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>Modo local:</strong> essa base ainda não chama IA real. Ela apenas organiza conhecimento para uso futuro.
          </span>
        </div>
      </div>

      {/* Simulador */}
      <SimulatorBlock />

      {/* Filtros e ações */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar título, palavra-chave, resposta…"
              className="h-9 pl-7 pr-8"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button size="sm" onClick={openNew} className="h-9 gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Novo
          </Button>
        </div>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <Chip active={cat === "all"} onClick={() => setCat("all")} count={countsByCat.all}>
            Todas
          </Chip>
          {CATS.map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)} count={countsByCat[c]}>
              {KB_CATEGORY_LABEL[c]}
            </Chip>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" /> Exportar
          </Button>
          <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Importar
          </Button>
          <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => setConfirmReset(true)}>
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <EmptyState icon={BookOpen} title="Nada por aqui" description="Crie uma nova resposta ou ajuste os filtros." />
      ) : (
        <ul className="space-y-2">
          {filtered.map((e) => (
            <li key={e.id} className={cn("rounded-xl border border-border bg-card p-3", !e.active && "opacity-60")}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold">{e.title}</span>
                    <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] text-muted-foreground">
                      {KB_CATEGORY_LABEL[e.category]}
                    </span>
                    {e.app && (
                      <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] text-muted-foreground">
                        {APP_CATALOG[e.app as keyof typeof APP_CATALOG]?.label ?? e.app}
                      </span>
                    )}
                    {e.needs_human && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-medium text-warning">
                        <UserCog className="h-3 w-3" /> humano
                      </span>
                    )}
                    {!e.active && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">inativo</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{e.short}</p>
                  {e.keywords.length > 0 && (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      🔎 {e.keywords.join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => openEdit(e)} className="rounded p-1.5 text-muted-foreground hover:bg-muted" aria-label="Editar">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setConfirmDelete(e)} className="rounded p-1.5 text-destructive hover:bg-destructive/10" aria-label="Excluir">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <EntrySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        initial={editing}
      />

      <AlertDialog open={confirmReset} onOpenChange={(o) => !o && setConfirmReset(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar base padrão</AlertDialogTitle>
            <AlertDialogDescription>
              Isso substitui todas as respostas locais pelos exemplos padrão. Faça exportação antes se quiser guardar suas mudanças.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doRestore}>Restaurar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{confirmDelete?.title}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!importPreview} onOpenChange={(o) => !o && setImportPreview(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Importar base</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm">
                Encontradas <strong>{importPreview?.length ?? 0}</strong> entradas no arquivo.
                Deseja mesclar com as existentes ou substituir?
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={doMerge}>Mesclar</Button>
            <AlertDialogAction onClick={doReplace} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

function Chip({
  children, active, onClick, count,
}: { children: React.ReactNode; active?: boolean; onClick: () => void; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground/80 hover:bg-muted",
      )}
    >
      {children}
      {typeof count === "number" && (
        <span className={cn("ml-1.5 rounded-full px-1.5 text-[10px]", active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground")}>
          {count}
        </span>
      )}
    </button>
  );
}

// ----- Simulador -----
function SimulatorBlock() {
  const [msg, setMsg] = useState("");
  const result = useMemo(() => msg.trim() ? simulate(msg) : null, [msg]);
  const examples = [
    "Bom dia", "Meu app não funciona", "Está travando", "Mandei áudio",
    "Qual meu vencimento?", "Bob Player pediu renovação", "Não sei meu MAC",
  ];
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" /> Simular atendimento
      </div>
      <Textarea
        rows={2}
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        placeholder="Digite uma mensagem de exemplo do cliente"
      />
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {examples.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setMsg(ex)}
            className="shrink-0 whitespace-nowrap rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] hover:bg-muted"
          >
            {ex}
          </button>
        ))}
      </div>
      {result && (
        <div className="space-y-2 rounded-lg border border-border bg-surface p-3 text-xs">
          <div><strong>Intenção:</strong> {result.intent}</div>
          {result.match ? (
            <>
              <div><strong>Resposta sugerida:</strong></div>
              <p className="whitespace-pre-wrap rounded bg-card p-2">{result.match.full}</p>
            </>
          ) : (
            <p className="text-muted-foreground">Sem resposta na base. Crie um item para essa intenção.</p>
          )}
          {result.askFor.length > 0 && (
            <div><strong>Pedir ao cliente:</strong> {result.askFor.join(", ")}</div>
          )}
          <div className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
            result.needsHuman ? "bg-warning-soft text-warning" : "bg-success-soft text-success")}>
            {result.needsHuman ? <><UserCog className="h-3 w-3" /> Chamar humano</> : <><MessageSquare className="h-3 w-3" /> IA pode responder</>}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Simulação local por palavras-chave. Não chama IA real.
          </p>
        </div>
      )}
    </div>
  );
}

// ----- Sheet de edição -----
function EntrySheet({
  open, onClose, initial,
}: { open: boolean; onClose: () => void; initial: KBEntry | null }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<KBCategory>("problema");
  const [app, setApp] = useState<string>("");
  const [keywords, setKeywords] = useState("");
  const [short, setShort] = useState("");
  const [full, setFull] = useState("");
  const [whenUse, setWhenUse] = useState("");
  const [whenNot, setWhenNot] = useState("");
  const [needsHuman, setNeedsHuman] = useState(false);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title);
      setCategory(initial.category);
      setApp(initial.app ?? "");
      setKeywords(initial.keywords.join(", "));
      setShort(initial.short);
      setFull(initial.full);
      setWhenUse(initial.when_to_use ?? "");
      setWhenNot(initial.when_not_to_use ?? "");
      setNeedsHuman(initial.needs_human);
      setActive(initial.active);
    } else {
      setTitle(""); setCategory("problema"); setApp("");
      setKeywords(""); setShort(""); setFull("");
      setWhenUse(""); setWhenNot(""); setNeedsHuman(false); setActive(true);
    }
  }, [open, initial]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !short.trim()) {
      toast.error("Preencha título e resposta curta.");
      return;
    }
    const now = new Date().toISOString();
    const entry: KBEntry = {
      id: initial?.id ?? newId(),
      title: title.trim(),
      category,
      app: app || undefined,
      keywords: keywords.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
      short: short.trim(),
      full: (full || short).trim(),
      when_to_use: whenUse.trim() || undefined,
      when_not_to_use: whenNot.trim() || undefined,
      needs_human: needsHuman,
      active,
      created_at: initial?.created_at ?? now,
      updated_at: now,
    };
    upsert(entry);
    toast.success(initial ? "Atualizado" : "Adicionado");
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="text-base">{initial ? "Editar resposta" : "Nova resposta"}</SheetTitle>
          <SheetDescription className="text-xs">Salvo localmente neste navegador.</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="flex-1 space-y-3 p-4">
          <Field label="Título *">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as KBCategory)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {CATS.map((c) => <option key={c} value={c}>{KB_CATEGORY_LABEL[c]}</option>)}
              </select>
            </Field>
            <Field label="Aplicativo (opcional)">
              <select
                value={app}
                onChange={(e) => setApp(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">— Qualquer —</option>
                {APP_OPTIONS.map((k) => (
                  <option key={k} value={k}>{APP_CATALOG[k].label}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Palavras-chave (separadas por vírgula)">
            <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="travando, lento, mac" />
          </Field>
          <Field label="Resposta curta *">
            <Textarea rows={2} value={short} onChange={(e) => setShort(e.target.value)} maxLength={300} required />
          </Field>
          <Field label="Resposta completa">
            <Textarea rows={4} value={full} onChange={(e) => setFull(e.target.value)} maxLength={2000} />
          </Field>
          <div className="grid grid-cols-1 gap-3">
            <Field label="Quando usar">
              <Textarea rows={2} value={whenUse} onChange={(e) => setWhenUse(e.target.value)} maxLength={300} />
            </Field>
            <Field label="Quando NÃO usar">
              <Textarea rows={2} value={whenNot} onChange={(e) => setWhenNot(e.target.value)} maxLength={300} />
            </Field>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <Checkbox checked={needsHuman} onCheckedChange={(v) => setNeedsHuman(!!v)} />
            <span>Encaminhar para humano</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <Checkbox checked={active} onCheckedChange={(v) => setActive(!!v)} />
            <span>Ativo</span>
          </label>

          <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-border bg-card px-4 py-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              <X className="mr-1 h-4 w-4" /> Cancelar
            </Button>
            <Button type="submit" className="flex-1 gap-1.5">
              <Save className="h-4 w-4" /> Salvar
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
