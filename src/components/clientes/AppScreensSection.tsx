import { useEffect, useMemo, useState } from "react";
import {
  Plus, Pencil, Archive, RotateCcw, Eye, EyeOff, Copy, ExternalLink,
  Tv, Loader2, X, Save, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { HelpTip } from "@/components/ui-premium/HelpTip";
import { EmptyState } from "@/components/ui-premium/EmptyState";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  APP_CATALOG, APP_OPTIONS, AppKey, AppScreen, AccessType, ScreenStatus,
  listScreens, upsertScreen, archiveScreen, reactivateScreen, newId,
  daysUntil, urgencyFromDays, urgencyClass, urgencyLabel, mask,
} from "@/lib/app-screens";

const STATUS_LABEL: Record<ScreenStatus, string> = {
  ativa: "Ativa",
  vencendo: "Vencendo",
  vencida: "Vencida",
  pausada: "Pausada",
  arquivada: "Arquivada",
};

const STATUS_CLASS: Record<ScreenStatus, string> = {
  ativa: "bg-success-soft text-success",
  vencendo: "bg-warning-soft text-warning",
  vencida: "bg-destructive/10 text-destructive",
  pausada: "bg-info-soft text-info",
  arquivada: "bg-muted text-muted-foreground",
};

function copyToClipboard(text: string, label: string) {
  if (!text) return;
  try {
    navigator.clipboard?.writeText(text);
    toast.success(`${label} copiado`);
  } catch {
    toast.error("Não foi possível copiar");
  }
}

export function AppScreensSection({ customerId }: { customerId: string }) {
  const [screens, setScreens] = useState<AppScreen[]>([]);
  const [editing, setEditing] = useState<AppScreen | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const refresh = () => setScreens(listScreens(customerId));

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("app-screens:changed", onChange);
    return () => window.removeEventListener("app-screens:changed", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const sorted = useMemo(() => {
    return [...screens].sort((a, b) => {
      const arch = (s: AppScreen) => (s.status === "arquivada" ? 1 : 0);
      if (arch(a) !== arch(b)) return arch(a) - arch(b);
      const da = daysUntil(a.due_date);
      const db = daysUntil(b.due_date);
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      // hoje primeiro, vencidos por último
      const ka = da < 0 ? 1000 + Math.abs(da) : da;
      const kb = db < 0 ? 1000 + Math.abs(db) : db;
      return ka - kb;
    });
  }, [screens]);

  const openNew = () => {
    setEditing(null);
    setSheetOpen(true);
  };
  const openEdit = (s: AppScreen) => {
    setEditing(s);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Tv className="h-3.5 w-3.5" /> Telas e aplicativos
          <HelpTip text="Use para separar quando o cliente tem mais de uma TV ou aparelho." />
        </h3>
        <Button size="sm" onClick={openNew} className="h-8 gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Adicionar tela
        </Button>
      </div>

      <div className="rounded-md border border-dashed border-warning/40 bg-warning-soft/40 p-2 text-[11px] text-warning">
        <AlertCircle className="mr-1 inline h-3 w-3" />
        Telas salvas localmente neste navegador (preview). Falta backend/RPC/tabela para persistir no servidor.
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={Tv}
          title="Sem telas cadastradas"
          description='Toque em "Adicionar tela" para registrar o primeiro aplicativo.'
        />
      ) : (
        <ul className="space-y-2">
          {sorted.map((s) => {
            const app = APP_CATALOG[s.app];
            const days = daysUntil(s.due_date);
            const urg = urgencyFromDays(days);
            const expanded = expandedId === s.id;
            return (
              <li key={s.id} className="rounded-xl border border-border bg-card shadow-card">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : s.id)}
                  className="flex w-full items-start gap-2 p-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold">{s.name}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", app.badgeClass)}>
                        {app.label}
                      </span>
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", STATUS_CLASS[s.status])}>
                        {STATUS_LABEL[s.status]}
                      </span>
                    </div>
                    {s.due_date && (
                      <div className="mt-1">
                        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium", urgencyClass(urg))}>
                          {urgencyLabel(urg, days)}
                        </span>
                      </div>
                    )}
                  </div>
                </button>

                {expanded && (
                  <div className="space-y-3 border-t border-border p-3">
                    {s.access_type === "user_pass" && (
                      <FieldGroup>
                        <FieldRow label="Usuário" value={s.username} onCopy={() => copyToClipboard(s.username ?? "", "Usuário")} />
                        <FieldRow
                          label="Senha"
                          value={revealed[s.id + ":pwd"] ? s.password : mask(s.password)}
                          onCopy={() => copyToClipboard(s.password ?? "", "Senha")}
                          onToggle={() => setRevealed((r) => ({ ...r, [s.id + ":pwd"]: !r[s.id + ":pwd"] }))}
                          revealed={!!revealed[s.id + ":pwd"]}
                          sensitive
                        />
                        <FieldRow label="Servidor" value={s.server} onCopy={() => copyToClipboard(s.server ?? "", "Servidor")} />
                        {s.port && <FieldRow label="Porta" value={s.port} onCopy={() => copyToClipboard(s.port ?? "", "Porta")} />}
                      </FieldGroup>
                    )}
                    {s.access_type === "mac_key" && (
                      <FieldGroup>
                        <FieldRow label="MAC" value={s.mac} onCopy={() => copyToClipboard(s.mac ?? "", "MAC")} />
                        <FieldRow
                          label="Key"
                          value={revealed[s.id + ":key"] ? s.app_key : mask(s.app_key)}
                          onCopy={() => copyToClipboard(s.app_key ?? "", "Key")}
                          onToggle={() => setRevealed((r) => ({ ...r, [s.id + ":key"]: !r[s.id + ":key"] }))}
                          revealed={!!revealed[s.id + ":key"]}
                          sensitive
                        />
                      </FieldGroup>
                    )}

                    {s.portal_url && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5"
                        onClick={() => window.open(s.portal_url, "_blank", "noopener,noreferrer")}
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Abrir portal do app
                      </Button>
                    )}

                    {s.notes && (
                      <p className="whitespace-pre-wrap rounded-md bg-surface p-2 text-xs text-muted-foreground">
                        {s.notes}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => openEdit(s)}>
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                      {s.status === "arquivada" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1.5"
                          onClick={() => {
                            reactivateScreen(customerId, s.id);
                            toast.success("Tela reativada");
                          }}
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Reativar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1.5 text-danger hover:text-danger"
                          onClick={() => {
                            archiveScreen(customerId, s.id);
                            toast.success("Tela arquivada");
                          }}
                        >
                          <Archive className="h-3.5 w-3.5" /> Arquivar
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ScreenSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        customerId={customerId}
        initial={editing}
      />
    </div>
  );
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5 rounded-lg border border-border bg-surface p-2">{children}</div>;
}

function FieldRow({
  label, value, onCopy, onToggle, revealed, sensitive,
}: {
  label: string;
  value?: string | null;
  onCopy?: () => void;
  onToggle?: () => void;
  revealed?: boolean;
  sensitive?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 flex-1 truncate font-medium", sensitive && !revealed && "tracking-widest")}>
        {value || "—"}
      </span>
      {onToggle && (
        <button type="button" onClick={onToggle} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label={revealed ? "Ocultar" : "Mostrar"}>
          {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      )}
      {onCopy && (
        <button type="button" onClick={onCopy} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label={`Copiar ${label}`}>
          <Copy className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ----- Sheet de cadastro/edição -----
function ScreenSheet({
  open, onClose, customerId, initial,
}: {
  open: boolean;
  onClose: () => void;
  customerId: string;
  initial: AppScreen | null;
}) {
  const [name, setName] = useState("");
  const [app, setApp] = useState<AppKey>("xciptv");
  const [accessType, setAccessType] = useState<AccessType>("user_pass");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [server, setServer] = useState("");
  const [port, setPort] = useState("");
  const [mac, setMac] = useState("");
  const [appKey, setAppKey] = useState("");
  const [portalUrl, setPortalUrl] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<ScreenStatus>("ativa");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setApp(initial.app);
      setAccessType(initial.access_type);
      setUsername(initial.username ?? "");
      setPassword(initial.password ?? "");
      setServer(initial.server ?? "");
      setPort(initial.port ?? "");
      setMac(initial.mac ?? "");
      setAppKey(initial.app_key ?? "");
      setPortalUrl(initial.portal_url ?? "");
      setDueDate(initial.due_date ?? "");
      setStatus(initial.status);
      setNotes(initial.notes ?? "");
    } else {
      setName("");
      setApp("xciptv");
      setAccessType(APP_CATALOG.xciptv.access);
      setUsername(""); setPassword(""); setServer(""); setPort("");
      setMac(""); setAppKey(""); setPortalUrl(""); setDueDate("");
      setStatus("ativa"); setNotes("");
    }
  }, [open, initial]);

  // Quando muda o app, sugere o tipo de acesso default
  useEffect(() => {
    const def = APP_CATALOG[app]?.access ?? "outro";
    if (def !== "outro") setAccessType(def);
  }, [app]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Informe o nome da tela.");
      return;
    }
    setBusy(true);
    const now = new Date().toISOString();
    const screen: AppScreen = {
      id: initial?.id ?? newId(),
      customer_id: customerId,
      name: name.trim(),
      app,
      access_type: accessType,
      username: username.trim() || undefined,
      password: password || undefined,
      server: server.trim() || undefined,
      port: port.trim() || undefined,
      mac: mac.trim() || undefined,
      app_key: appKey.trim() || undefined,
      portal_url: portalUrl.trim() || undefined,
      due_date: dueDate || undefined,
      status,
      notes: notes.trim() || undefined,
      created_at: initial?.created_at ?? now,
      updated_at: now,
    };
    upsertScreen(screen);
    setBusy(false);
    toast.success(initial ? "Tela atualizada" : "Tela adicionada");
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="text-base">
            {initial ? "Editar tela" : "Adicionar tela/app"}
          </SheetTitle>
          <SheetDescription className="text-xs">
            Dados salvos localmente neste navegador.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} className="flex-1 space-y-4 p-4">
          <Field label="Nome da tela" hint="Use para separar quando o cliente tem mais de uma TV ou aparelho.">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tela 1, TV Sala…" maxLength={60} required />
          </Field>

          <Field label="Aplicativo" hint="Escolha o app que o cliente usa na TV ou celular.">
            <select
              value={app}
              onChange={(e) => setApp(e.target.value as AppKey)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              {APP_OPTIONS.map((k) => (
                <option key={k} value={k}>{APP_CATALOG[k].label}</option>
              ))}
            </select>
          </Field>

          <Field label="Tipo de acesso">
            <select
              value={accessType}
              onChange={(e) => setAccessType(e.target.value as AccessType)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="user_pass">Usuário e senha</option>
              <option value="mac_key">MAC e Key</option>
              <option value="outro">Outro</option>
            </select>
          </Field>

          {accessType === "user_pass" && (
            <div className="space-y-3 rounded-lg border border-border bg-surface p-3">
              <Field label="Usuário"><Input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={120} /></Field>
              <Field label="Senha"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={200} /></Field>
              <Field label="Servidor / link" hint="Link usado no aplicativo do cliente."><Input value={server} onChange={(e) => setServer(e.target.value)} maxLength={300} placeholder="http://servidor:porta" /></Field>
              <Field label="Porta (opcional)"><Input value={port} onChange={(e) => setPort(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" /></Field>
            </div>
          )}

          {accessType === "mac_key" && (
            <div className="space-y-3 rounded-lg border border-border bg-surface p-3">
              <Field label="MAC" hint="Código do aparelho usado em apps como Bob Player e IBO.">
                <Input value={mac} onChange={(e) => setMac(e.target.value)} placeholder="00:1A:2B:3C:4D:5E" maxLength={32} />
              </Field>
              <Field label="Key" hint="Chave do aplicativo. Alguns apps pedem MAC e Key para ativação.">
                <Input value={appKey} onChange={(e) => setAppKey(e.target.value)} maxLength={200} />
              </Field>
              <Field label="Link do portal" hint="Portal do aplicativo, abre em nova aba.">
                <Input value={portalUrl} onChange={(e) => setPortalUrl(e.target.value)} placeholder="https://…" maxLength={500} />
              </Field>
            </div>
          )}

          {accessType === "outro" && (
            <Field label="Link do portal (opcional)">
              <Input value={portalUrl} onChange={(e) => setPortalUrl(e.target.value)} placeholder="https://…" maxLength={500} />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Vencimento da tela">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ScreenStatus)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="ativa">Ativa</option>
                <option value="vencendo">Vencendo</option>
                <option value="vencida">Vencida</option>
                <option value="pausada">Pausada</option>
                <option value="arquivada">Arquivada</option>
              </select>
            </Field>
          </div>

          <Field label="Observações">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={1000} />
          </Field>

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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <Label className="text-xs">{label}</Label>
        {hint && <HelpTip text={hint} />}
      </div>
      {children}
    </div>
  );
}
