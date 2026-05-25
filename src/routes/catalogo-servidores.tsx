import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Server, Plus, Pencil, Archive, RotateCcw, Download, Upload, RefreshCcw,
  ExternalLink, Copy, Eye, EyeOff, X, Save, Loader2, AlertCircle, Share2,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { EmptyState } from "@/components/ui-premium/EmptyState";
import { HelpTip } from "@/components/ui-premium/HelpTip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  ServerEntry, listServers, saveServer, archiveServer, reactivateServer,
  restoreDefaultServers, exportServers, parseServerBackup, importServers,
  newServerId, serverBadgeStyle, maskSecret, formatServerAsText,
  SERVER_CATALOG_EVENT,
} from "@/lib/server-catalog";
import { useSecurityGuard } from "@/components/security/PinConfirmDialog";
import { ProtectedModeBadge } from "@/components/security/ProtectedModeBadge";
import { canCreateServer } from "@/lib/plan-limits";
import { PlanLimitNotice } from "@/components/companies/PlanLimitNotice";


export const Route = createFileRoute("/catalogo-servidores")({
  component: CatalogoServidoresPage,
});

const COLOR_PRESETS = [
  "#6366f1", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#64748b",
  "#ef4444", "#ec4899", "#14b8a6", "#eab308", "#0ea5e9", "#8b5cf6",
];

function todayStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function copyText(text: string, label: string) {
  if (!text) return;
  try {
    navigator.clipboard?.writeText(text);
    toast.success(`${label} copiado`);
  } catch {
    toast.error("Não foi possível copiar");
  }
}

function CatalogoServidoresPage() {
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [editing, setEditing] = useState<ServerEntry | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [importPreview, setImportPreview] = useState<ServerEntry[] | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const { guard, dialog: securityDialog } = useSecurityGuard();

  const refresh = () => setServers(listServers());

  useEffect(() => {
    refresh();
    const bump = () => refresh();
    window.addEventListener(SERVER_CATALOG_EVENT, bump);
    return () => window.removeEventListener(SERVER_CATALOG_EVENT, bump);
  }, []);

  const sorted = useMemo(() => {
    return [...servers].sort((a, b) => {
      if (a.status !== b.status) return a.status === "ativo" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [servers]);

  const openNew = () => { setEditing(null); setSheetOpen(true); };
  const openEdit = (s: ServerEntry) => { setEditing(s); setSheetOpen(true); };

  const handleExport = () => {
    guard({
      kind: "backup",
      title: "Exportar catálogo de servidores",
      description: "Inclui senhas dos painéis. Confirme com PIN.",
      actionLabel: "Exportar",
      onConfirm: () => {
        const data = exportServers();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `catalogo-servidores-cobranca-ia-${todayStamp()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success("Catálogo exportado.");
      },
    });
  };


  const handleImportClick = () => fileInput.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const txt = await file.text();
      const res = parseServerBackup(txt);
      if (!res.ok) {
        toast.error("Arquivo inválido.");
        return;
      }
      setImportPreview(res.servers);
    } catch {
      toast.error("Não foi possível ler o arquivo.");
    }
  };

  return (
    <PageContainer>
      <div className="mb-1"><ProtectedModeBadge /></div>
      <SectionHeader
        title="Servidores"
        subtitle="Configure os servidores e painéis usados nas telas dos clientes."
      />


      <div className="mb-3 rounded-md border border-warning/40 bg-warning-soft/40 p-2 text-[11px] text-warning">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Salvo apenas neste navegador. Nenhum painel será acessado automaticamente.</span>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={openNew} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Adicionar servidor
        </Button>
        <Button size="sm" variant="outline" onClick={handleExport} className="gap-1.5">
          <Download className="h-3.5 w-3.5" /> Exportar
        </Button>
        <Button size="sm" variant="outline" onClick={handleImportClick} className="gap-1.5">
          <Upload className="h-3.5 w-3.5" /> Importar
        </Button>
        <Button size="sm" variant="outline" onClick={() => setConfirmRestore(true)} className="gap-1.5">
          <RefreshCcw className="h-3.5 w-3.5" /> Restaurar padrões
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={Server} title="Nenhum servidor cadastrado" description='Toque em "Adicionar servidor".' />
      ) : (
        <ul className="space-y-2">
          {sorted.map((s) => (
            <ServerCard key={s.id} server={s} onEdit={() => openEdit(s)} />
          ))}
        </ul>
      )}

      <ServerSheet
        open={sheetOpen}
        initial={editing}
        onClose={() => setSheetOpen(false)}
      />

      <AlertDialog open={confirmRestore} onOpenChange={(o) => !o && setConfirmRestore(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar servidores padrões</AlertDialogTitle>
            <AlertDialogDescription>
              Adiciona os servidores padrões que estiverem faltando (Lunar, Solar, Principal,
              Alternativo, Teste, Outro). Os existentes não são alterados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setConfirmRestore(false);
              guard({
                kind: "delete",
                title: "Restaurar servidores padrões",
                actionLabel: "Restaurar",
                onConfirm: () => { restoreDefaultServers(); toast.success("Padrões restaurados."); },
              });
            }}>
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!importPreview} onOpenChange={(o) => !o && setImportPreview(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Importar catálogo</AlertDialogTitle>
            <AlertDialogDescription>
              {importPreview ? `${importPreview.length} servidor(es) encontrado(s). Mesclar ou substituir os atuais?` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={() => {
              const items = importPreview;
              setImportPreview(null);
              if (!items) return;
              guard({
                kind: "backup",
                title: "Mesclar catálogo importado",
                actionLabel: "Mesclar",
                onConfirm: () => { importServers(items, "merge"); toast.success("Catálogo mesclado."); },
              });
            }}>
              Mesclar
            </Button>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const items = importPreview;
                setImportPreview(null);
                if (!items) return;
                guard({
                  kind: "delete",
                  title: "Substituir catálogo de servidores",
                  description: "Esta ação remove os servidores atuais e usa os importados.",
                  actionLabel: "Substituir",
                  onConfirm: () => { importServers(items, "replace"); toast.success("Catálogo substituído."); },
                });
              }}
            >
              Substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {securityDialog}
    </PageContainer>
  );
}

function ServerCard({
  server,
  onEdit,
}: {
  server: ServerEntry;
  onEdit: () => void;
}) {
  const [reveal, setReveal] = useState(false);
  const [askReveal, setAskReveal] = useState(false);
  const [askCopyPwd, setAskCopyPwd] = useState(false);
  const [askCopyFull, setAskCopyFull] = useState(false);
  const { guard, dialog: securityDialog } = useSecurityGuard();
  const isActive = server.status === "ativo";

  return (
    <li className="rounded-xl border border-border bg-card p-3 shadow-card">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold"
              style={serverBadgeStyle(server.color)}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: server.color }} />
              {server.name}
            </span>
            {!isActive && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Inativo
              </span>
            )}
          </div>
          {server.panel_url && (
            <p className="mt-1 truncate text-xs text-muted-foreground">{server.panel_url}</p>
          )}
          <div className="mt-2 space-y-1 text-xs">
            {server.panel_username && (
              <div className="flex items-center gap-2">
                <span className="w-16 text-muted-foreground">Usuário</span>
                <span className="min-w-0 flex-1 truncate font-medium">{server.panel_username}</span>
                <button onClick={() => copyText(server.panel_username!, "Usuário")} className="rounded p-1 hover:bg-muted">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {server.panel_password && (
              <div className="flex items-center gap-2">
                <span className="w-16 text-muted-foreground">Senha</span>
                <span className={cn("min-w-0 flex-1 truncate font-medium", !reveal && "tracking-widest")}>
                  {reveal ? server.panel_password : maskSecret(server.panel_password)}
                </span>
                <button
                  onClick={() => { if (!reveal) setAskReveal(true); else setReveal(false); }}
                  className="rounded p-1 hover:bg-muted"
                >
                  {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => setAskCopyPwd(true)} className="rounded p-1 hover:bg-muted">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {server.notes && (
              <p className="rounded bg-surface p-2 text-muted-foreground whitespace-pre-wrap">{server.notes}</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {server.panel_url && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => window.open(server.panel_url, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="h-3.5 w-3.5" /> Abrir painel
          </Button>
        )}
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAskCopyFull(true)}>
          <Share2 className="h-3.5 w-3.5" /> Copiar dados
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" /> Editar
        </Button>
        {isActive ? (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-danger hover:text-danger"
            onClick={() => guard({
              kind: "delete",
              title: `Inativar servidor ${server.name}`,
              actionLabel: "Inativar",
              onConfirm: () => { archiveServer(server.id); toast.success("Servidor inativado"); },
            })}
          >
            <Archive className="h-3.5 w-3.5" /> Inativar
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => { reactivateServer(server.id); toast.success("Servidor reativado"); }}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reativar
          </Button>
        )}
      </div>

      <AlertDialog open={askReveal} onOpenChange={(o) => !o && setAskReveal(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mostrar senha do painel?</AlertDialogTitle>
            <AlertDialogDescription>Esses dados são sensíveis.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setAskReveal(false);
              guard({
                kind: "server_password",
                title: "Mostrar senha do painel",
                actionLabel: "Mostrar",
                onConfirm: () => setReveal(true),
              });
            }}>Mostrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={askCopyPwd} onOpenChange={(o) => !o && setAskCopyPwd(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copiar senha do painel?</AlertDialogTitle>
            <AlertDialogDescription>Esses dados são sensíveis.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setAskCopyPwd(false);
              guard({
                kind: "server_password",
                title: "Copiar senha do painel",
                actionLabel: "Copiar",
                onConfirm: () => copyText(server.panel_password ?? "", "Senha"),
              });
            }}>
              Copiar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={askCopyFull} onOpenChange={(o) => !o && setAskCopyFull(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copiar dados do servidor</AlertDialogTitle>
            <AlertDialogDescription>Senha mascarada por padrão.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={() => {
              copyText(formatServerAsText(server, { revealSecrets: false }), "Dados do servidor");
              setAskCopyFull(false);
            }}>Copiar mascarado</Button>
            <AlertDialogAction onClick={() => {
              setAskCopyFull(false);
              guard({
                kind: "server_password",
                title: "Copiar dados com senha visível",
                actionLabel: "Copiar",
                onConfirm: () => copyText(formatServerAsText(server, { revealSecrets: true }), "Dados do servidor (c/ senha)"),
              });
            }}>Copiar com senha</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {securityDialog}
    </li>
  );
}

function ServerSheet({
  open, initial, onClose,
}: {
  open: boolean;
  initial: ServerEntry | null;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [panelUrl, setPanelUrl] = useState("");
  const [panelUser, setPanelUser] = useState("");
  const [panelPwd, setPanelPwd] = useState("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setColor(initial.color);
      setPanelUrl(initial.panel_url ?? "");
      setPanelUser(initial.panel_username ?? "");
      setPanelPwd(initial.panel_password ?? "");
      setNotes(initial.notes ?? "");
      setActive(initial.status === "ativo");
    } else {
      setName("");
      setColor(COLOR_PRESETS[0]);
      setPanelUrl("");
      setPanelUser("");
      setPanelPwd("");
      setNotes("");
      setActive(true);
    }
  }, [open, initial]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Informe o nome do servidor."); return; }
    setBusy(true);
    const now = new Date().toISOString();
    saveServer({
      id: initial?.id ?? newServerId(),
      name: name.trim(),
      color,
      panel_url: panelUrl.trim() || undefined,
      panel_username: panelUser.trim() || undefined,
      panel_password: panelPwd || undefined,
      notes: notes.trim() || undefined,
      status: active ? "ativo" : "inativo",
      created_at: initial?.created_at ?? now,
      updated_at: now,
    });
    setBusy(false);
    toast.success(initial ? "Servidor atualizado" : "Servidor adicionado");
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="text-base">{initial ? "Editar servidor" : "Adicionar servidor"}</SheetTitle>
          <SheetDescription className="text-xs">
            Apenas o nome é obrigatório. Painel, usuário e senha são opcionais.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} className="flex-1 space-y-4 p-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome do servidor *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label className="text-xs">Cor do badge</Label>
              <HelpTip text="Cor usada para destacar este servidor nas telas dos clientes." />
            </div>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-transform",
                    color === c ? "border-foreground scale-110" : "border-transparent hover:scale-105",
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-7 w-12 cursor-pointer rounded border border-border bg-transparent"
                aria-label="Cor personalizada"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label className="text-xs">Link do painel (opcional)</Label>
              <HelpTip text="Site usado para gerenciar usuários nesse servidor." />
            </div>
            <Input value={panelUrl} onChange={(e) => setPanelUrl(e.target.value)} placeholder="https://painel.exemplo.com" maxLength={500} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Usuário do painel (opcional)</Label>
            <Input value={panelUser} onChange={(e) => setPanelUser(e.target.value)} maxLength={120} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Senha do painel (opcional)</Label>
            <Input type="password" value={panelPwd} onChange={(e) => setPanelPwd(e.target.value)} maxLength={200} />
            <p className="text-[10px] text-muted-foreground">
              A senha fica mascarada na lista e só pode ser copiada com confirmação.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observações (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={1000} />
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface p-3 text-xs">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4" />
            <span>Servidor ativo (aparece na seleção das telas)</span>
          </label>

          <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-border bg-card px-4 py-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="flex-1">
              <X className="mr-1 h-4 w-4" /> Cancelar
            </Button>
            <Button type="submit" disabled={busy} className="flex-1 gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
