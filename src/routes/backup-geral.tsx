import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Download, Upload, ShieldCheck, FileText, RefreshCw, AlertTriangle,
  CheckCircle2, Info,
} from "lucide-react";

import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

import {
  BACKUP_MODULES, type BackupFile, type ModuleSummary, type RestoreMode,
  exportFullBackup, exportHealthReportTxt, getLocalDataHealth, getModuleSummaries,
  parseFullBackup, restoreFullBackup,
} from "@/lib/backup-geral";
import { useSecurityGuard } from "@/components/security/PinConfirmDialog";

export const Route = createFileRoute("/backup-geral")({
  head: () => ({
    meta: [
      { title: "Backup Geral — Cobrança IA" },
      { name: "description", content: "Exporte, importe e valide um backup completo dos dados locais do sistema." },
    ],
  }),
  component: BackupGeralPage,
});

type PreviewState = {
  file: BackupFile;
  warnings: string[];
};

function BackupGeralPage() {
  const [summaries, setSummaries] = useState<ModuleSummary[]>([]);
  const [health, setHealth] = useState(() => ({
    status: "ok" as "ok" | "warning" | "review",
    issues: [] as { level: "info" | "warning" | "review"; message: string }[],
    totals: {} as Record<string, number>,
  }));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [confirmMode, setConfirmMode] = useState<RestoreMode | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const { guard, dialog: securityDialog } = useSecurityGuard();

  const refresh = useCallback(() => {
    setSummaries(getModuleSummaries());
    setHealth(getLocalDataHealth());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleExport = () => {
    guard({
      kind: "backup",
      title: "Exportar backup geral",
      description: "O arquivo conterá dados sensíveis. Confirme com PIN.",
      actionLabel: "Exportar",
      onConfirm: () => {
        try {
          const b = exportFullBackup();
          toast.success(`Backup gerado com ${b.modules.length} módulo(s).`);
        } catch {
          toast.error("Não foi possível gerar o backup.");
        }
      },
    });
  };


  const handleReport = () => {
    try {
      exportHealthReportTxt();
      toast.success("Relatório TXT baixado.");
    } catch {
      toast.error("Não foi possível gerar o relatório.");
    }
  };

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const result = await parseFullBackup(f);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPreview({ file: result.data, warnings: result.warnings });
  };

  const startRestore = (mode: RestoreMode) => {
    if (mode === "replace") {
      setConfirmReplace(true);
      return;
    }
    setConfirmMode("merge");
  };

  const doRestore = (mode: RestoreMode) => {
    if (!preview) return;
    try {
      const { restored, skipped } = restoreFullBackup(preview.file, mode);
      toast.success(
        `Backup restaurado (${mode === "replace" ? "substituir" : "mesclar"}): ${restored} módulo(s).${
          skipped ? ` ${skipped} ignorado(s).` : ""
        }`,
      );
      setPreview(null);
      setConfirmMode(null);
      setConfirmReplace(false);
      refresh();
    } catch {
      toast.error("Falha ao restaurar backup.");
    }
  };

  const totalItems = useMemo(
    () => summaries.reduce((acc, s) => acc + (s.present ? s.count : 0), 0),
    [summaries],
  );

  const healthBadge = useMemo(() => {
    if (health.status === "ok") {
      return { text: "Tudo certo", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20", Icon: CheckCircle2 };
    }
    if (health.status === "warning") {
      return { text: "Atenção", className: "bg-amber-500/10 text-amber-700 border-amber-500/20", Icon: AlertTriangle };
    }
    return { text: "Precisa revisar", className: "bg-red-500/10 text-red-700 border-red-500/20", Icon: AlertTriangle };
  }, [health.status]);

  const checklistItems = [
    "Fiz backup geral",
    "Exportei financeiro",
    "Exportei telas/apps",
    "Exportei servidores",
    "Sei que os dados estão apenas neste navegador",
    "Não ativei envio real",
    "Não publiquei produção",
  ];

  return (
    <PageContainer>
      <SectionHeader
        title="Backup Geral"
        subtitle="Proteja seus dados locais exportando um backup completo do sistema."
      />

      <Card className="border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex gap-3">
          <Info className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-foreground/80">
            Esses dados estão salvos apenas neste navegador. Faça backup antes de trocar de aparelho, limpar cache ou testar alterações grandes.
          </p>
        </div>
      </Card>

      {/* Ações principais */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Button onClick={handleExport} className="h-12 justify-start gap-2">
          <Download className="h-4 w-4" /> Exportar backup geral
        </Button>
        <Button onClick={handlePickFile} variant="outline" className="h-12 justify-start gap-2">
          <Upload className="h-4 w-4" /> Importar backup geral
        </Button>
        <Button onClick={refresh} variant="outline" className="h-12 justify-start gap-2">
          <RefreshCw className="h-4 w-4" /> Validar dados locais
        </Button>
        <Button onClick={handleReport} variant="outline" className="h-12 justify-start gap-2">
          <FileText className="h-4 w-4" /> Exportar relatório TXT
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFile}
        className="hidden"
      />

      {/* Cards de resumo */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground/80">Resumo dos dados locais</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {summaries.map((s) => (
            <Card key={s.key} className="p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.present ? s.count : 0}</p>
              <p className="text-[11px] text-muted-foreground">
                {s.present ? "Salvo neste navegador" : "Vazio"}
              </p>
            </Card>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Total agregado de itens locais: {totalItems}</p>
      </section>

      {/* Saúde dos dados */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Saúde dos dados locais</h3>
          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs", healthBadge.className)}>
            <healthBadge.Icon className="h-3 w-3" /> {healthBadge.text}
          </span>
        </div>
        {health.issues.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum alerta encontrado.</p>
        ) : (
          <ul className="space-y-1.5">
            {health.issues.map((i, idx) => (
              <li key={idx} className="flex gap-2 text-sm">
                <span
                  className={cn(
                    "mt-0.5 inline-flex h-2 w-2 shrink-0 rounded-full",
                    i.level === "review" ? "bg-red-500" : i.level === "warning" ? "bg-amber-500" : "bg-sky-500",
                  )}
                />
                <span className="text-foreground/80">{i.message}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Os ajustes nunca acontecem automaticamente. Revise nas telas correspondentes.
        </p>
      </Card>

      {/* O que está incluído */}
      <Card className="space-y-2 p-4">
        <h3 className="text-sm font-semibold">O que está incluído no backup</h3>
        <ul className="grid grid-cols-1 gap-1 text-sm text-foreground/80 sm:grid-cols-2">
          {BACKUP_MODULES.map((m) => (
            <li key={m.key} className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> {m.label}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          O backup é gerado e baixado apenas neste dispositivo. Nada é enviado para servidor.
        </p>
      </Card>

      {/* Antes de continuar */}
      <Card className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">Antes de continuar</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {checklistItems.map((item) => (
            <label
              key={item}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-2 text-sm"
            >
              <Checkbox
                checked={!!checks[item]}
                onCheckedChange={(v) => setChecks((p) => ({ ...p, [item]: !!v }))}
              />
              <span>{item}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Esse checklist é apenas visual, para sua organização.</p>
      </Card>

      {/* Sheet de prévia de importação */}
      <Sheet open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto sm:max-w-xl sm:mx-auto">
          <SheetHeader>
            <SheetTitle>Prévia do backup</SheetTitle>
            <SheetDescription>
              Confira o conteúdo antes de restaurar. Nenhuma alteração é feita até você confirmar.
            </SheetDescription>
          </SheetHeader>

          {preview && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Sistema</p>
                  <p className="font-medium">{preview.file.system}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Versão</p>
                  <p className="font-medium">v{preview.file.version || "—"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Data do backup</p>
                  <p className="font-medium">
                    {preview.file.exportedAt
                      ? new Date(preview.file.exportedAt).toLocaleString("pt-BR")
                      : "—"}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Módulos encontrados</p>
                <ul className="space-y-1 text-sm">
                  {BACKUP_MODULES.map((m) => {
                    const has = Object.prototype.hasOwnProperty.call(preview.file.data, m.key);
                    const v = preview.file.data[m.key];
                    const count = Array.isArray(v)
                      ? v.length
                      : v && typeof v === "object"
                      ? Object.keys(v as object).length
                      : 0;
                    return (
                      <li key={m.key} className="flex items-center justify-between gap-2">
                        <span className={cn(!has && "text-muted-foreground")}>{m.label}</span>
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {has ? `${count} item(ns)` : "—"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {preview.warnings.length > 0 && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700">
                  {preview.warnings.map((w, i) => <p key={i}>• {w}</p>)}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Deseja importar este backup? Os dados locais podem ser alterados.
              </p>
            </div>
          )}

          <SheetFooter className="mt-4 flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setPreview(null)}>Cancelar</Button>
            <Button variant="outline" onClick={() => startRestore("merge")}>Mesclar com dados atuais</Button>
            <Button variant="destructive" onClick={() => startRestore("replace")}>Substituir dados atuais</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Confirmação simples (merge) */}
      <AlertDialog open={confirmMode === "merge"} onOpenChange={(o) => !o && setConfirmMode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mesclar dados deste backup?</AlertDialogTitle>
            <AlertDialogDescription>
              Itens novos serão adicionados e itens com mesmo identificador serão atualizados pelos do backup.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => doRestore("merge")}>Mesclar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação forte (replace) */}
      <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir dados locais?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso pode substituir dados locais deste navegador. Recomendamos exportar um backup antes. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => doRestore("replace")}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
