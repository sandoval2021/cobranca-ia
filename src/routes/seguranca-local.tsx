import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ShieldCheck, ShieldOff, Lock, Unlock, KeyRound, EyeOff, AlertTriangle,
} from "lucide-react";

import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import {
  type LocalSecuritySettings,
  LOCAL_SECURITY_EVENT,
  getLocalSecuritySettings, saveLocalSecuritySettings,
  setupPin, changePin, disablePinProtection,
  isUnlocked, lockNow, unlockWithPin,
} from "@/lib/local-security";
import { LocalRoleSwitcher } from "@/components/auth/LocalRoleSwitcher";

export const Route = createFileRoute("/seguranca-local")({
  head: () => ({
    meta: [
      { title: "Segurança Local — CobraEasy" },
      { name: "description", content: "Proteja dados sensíveis deste navegador com PIN e modo protegido." },
    ],
  }),
  component: SegurancaLocalPage,
});

function SegurancaLocalPage() {
  const [settings, setSettings] = useState<LocalSecuritySettings>(getLocalSecuritySettings());
  const [unlocked, setUnlocked] = useState(isUnlocked());

  // setup/change PIN form
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");

  // unlock form
  const [unlockPin, setUnlockPin] = useState("");

  useEffect(() => {
    const refresh = () => {
      setSettings(getLocalSecuritySettings());
      setUnlocked(isUnlocked());
    };
    window.addEventListener(LOCAL_SECURITY_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LOCAL_SECURITY_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const hasPin = !!settings.pin_hash;

  const update = (patch: Partial<LocalSecuritySettings>) => {
    const next = saveLocalSecuritySettings(patch);
    setSettings(next);
  };

  const handleCreatePin = async () => {
    if (newPin.length < 4) { toast.error("PIN deve ter ao menos 4 dígitos."); return; }
    if (newPin !== confirmPin) { toast.error("PINs não conferem."); return; }
    try {
      await setupPin(newPin);
      setNewPin(""); setConfirmPin("");
      toast.success("PIN criado. Proteção ativada.");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível criar PIN.");
    }
  };

  const handleChangePin = async () => {
    if (currentPin.length < 4 || newPin.length < 4) { toast.error("Preencha os PINs."); return; }
    if (newPin !== confirmPin) { toast.error("Novos PINs não conferem."); return; }
    try {
      await changePin(currentPin, newPin);
      setCurrentPin(""); setNewPin(""); setConfirmPin("");
      toast.success("PIN alterado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível alterar PIN.");
    }
  };

  const handleDisable = async () => {
    if (!confirm("Desativar proteção por PIN? Dados continuam salvos, mas sem PIN.")) return;
    if (currentPin.length < 4) { toast.error("Digite seu PIN atual para desativar."); return; }
    const { verifyPin } = await import("@/lib/local-security");
    const ok = await verifyPin(currentPin);
    if (!ok) { toast.error("PIN incorreto."); return; }
    disablePinProtection();
    setCurrentPin("");
    toast.success("Proteção desativada.");
  };

  const handleUnlock = async () => {
    const ok = await unlockWithPin(unlockPin);
    setUnlockPin("");
    if (ok) toast.success("Desbloqueado.");
    else toast.error("PIN incorreto.");
  };

  return (
    <PageContainer>
      <SectionHeader
        title="Segurança"
        subtitle="Proteja dados sensíveis deste navegador com PIN e modo protegido."
      />

      <div className="mb-4">
        <LocalRoleSwitcher />
      </div>



      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3 text-sm flex gap-2 mb-4">
        <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
        <p>
          <strong>Segurança local:</strong> este PIN protege apenas este navegador.
          Não substitui login seguro no servidor.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Status */}
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            {settings.enabled ? <ShieldCheck className="h-4 w-4 text-emerald-600" /> : <ShieldOff className="h-4 w-4 text-muted-foreground" />}
            Status da proteção
          </h3>
          <div className="text-sm space-y-1">
            <p>Proteção: <strong>{settings.enabled ? "Ativada" : "Desativada"}</strong></p>
            <p>PIN cadastrado: <strong>{hasPin ? "Sim" : "Não"}</strong></p>
            <p>Sessão: <strong>{unlocked ? "Desbloqueada" : "Bloqueada"}</strong></p>
            {settings.last_unlock_at && (
              <p className="text-xs text-muted-foreground">
                Último desbloqueio: {new Date(settings.last_unlock_at).toLocaleString("pt-BR")}
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => { lockNow(); toast.success("Bloqueado."); }} disabled={!hasPin}>
              <Lock className="h-4 w-4 mr-1" /> Bloquear agora
            </Button>
          </div>

          {hasPin && !unlocked && (
            <div className="pt-2 border-t space-y-2">
              <Label>Desbloquear sessão</Label>
              <div className="flex gap-2">
                <Input
                  type="password" inputMode="numeric" value={unlockPin}
                  onChange={(e) => setUnlockPin(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  className="text-center text-xl tracking-[0.4em] h-12"
                  onKeyDown={(e) => { if (e.key === "Enter") handleUnlock(); }}
                />
                <Button onClick={handleUnlock} disabled={unlockPin.length < 4}>
                  <Unlock className="h-4 w-4 mr-1" /> Desbloquear
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* PIN */}
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            {hasPin ? "Alterar PIN" : "Criar PIN"}
          </h3>
          <div className="space-y-2">
            {hasPin && (
              <div>
                <Label>PIN atual</Label>
                <Input
                  type="password" inputMode="numeric" value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  className="h-11 text-center text-lg tracking-[0.4em]"
                />
              </div>
            )}
            <div>
              <Label>{hasPin ? "Novo PIN" : "PIN"} (mín. 4 dígitos)</Label>
              <Input
                type="password" inputMode="numeric" value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 12))}
                className="h-11 text-center text-lg tracking-[0.4em]"
              />
            </div>
            <div>
              <Label>Confirmar {hasPin ? "novo " : ""}PIN</Label>
              <Input
                type="password" inputMode="numeric" value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 12))}
                className="h-11 text-center text-lg tracking-[0.4em]"
              />
            </div>
            <div className="flex gap-2 flex-wrap pt-1">
              {hasPin ? (
                <>
                  <Button size="sm" onClick={handleChangePin}>Alterar PIN</Button>
                  <Button size="sm" variant="destructive" onClick={handleDisable}>Desativar proteção</Button>
                </>
              ) : (
                <Button size="sm" onClick={handleCreatePin}>Ativar proteção e criar PIN</Button>
              )}
            </div>
          </div>
        </Card>

        {/* Regras */}
        <Card className="p-4 space-y-3 md:col-span-2">
          <h3 className="font-semibold">Regras de proteção</h3>
          <p className="text-xs text-muted-foreground">
            Selecione onde exigir PIN. Aplica-se apenas se a proteção estiver ativa.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <ToggleRow
              label="Exigir PIN para Backup Geral (exportar/importar/substituir)"
              checked={settings.require_pin_on_backup}
              onChange={(v) => update({ require_pin_on_backup: v })}
            />
            <ToggleRow
              label="Exigir PIN para Financeiro (excluir/exportar/importar)"
              checked={settings.require_pin_on_finance}
              onChange={(v) => update({ require_pin_on_finance: v })}
            />
            <ToggleRow
              label="Exigir PIN para senhas de painel/servidor"
              checked={settings.require_pin_on_server_password}
              onChange={(v) => update({ require_pin_on_server_password: v })}
            />
            <ToggleRow
              label="Exigir PIN para Key/senha de aplicativo"
              checked={settings.require_pin_on_app_key}
              onChange={(v) => update({ require_pin_on_app_key: v })}
            />
            <ToggleRow
              label="Exigir PIN para excluir dados locais"
              checked={settings.require_pin_on_delete}
              onChange={(v) => update({ require_pin_on_delete: v })}
            />
            <ToggleRow
              label="Exigir PIN para outras ações sensíveis"
              checked={settings.require_pin_on_sensitive_actions}
              onChange={(v) => update({ require_pin_on_sensitive_actions: v })}
            />
          </div>
        </Card>

        {/* Auto-bloqueio */}
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><Lock className="h-4 w-4" /> Bloqueio automático</h3>
          <Label>Tempo de inatividade (minutos). 0 = nunca.</Label>
          <Input
            type="number" min={0} max={240}
            value={settings.auto_lock_minutes}
            onChange={(e) => update({ auto_lock_minutes: Math.max(0, Math.min(240, Number(e.target.value) || 0)) })}
          />
          <p className="text-xs text-muted-foreground">
            Após esse tempo desde o último desbloqueio, ações protegidas pedirão PIN novamente.
          </p>
        </Card>

        {/* Modo protegido */}
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><EyeOff className="h-4 w-4" /> Modo protegido visual</h3>
          <ToggleRow
            label="Ativar modo protegido (mascara dados sensíveis na interface)"
            checked={settings.protected_mode}
            onChange={(v) => update({ protected_mode: v })}
          />
          <ToggleRow
            label="Esconder dados sensíveis por padrão (senhas, keys)"
            checked={settings.hide_sensitive_by_default}
            onChange={(v) => update({ hide_sensitive_by_default: v })}
          />
          <p className="text-xs text-muted-foreground">
            Quando ativo, senhas e chaves aparecem mascaradas (•••) até serem reveladas com PIN.
          </p>
        </Card>
      </div>

      <div className="mt-6 rounded-lg border p-3 text-xs text-muted-foreground space-y-1">
        <p><strong>Como o PIN é salvo:</strong> apenas hash SHA-256 com salt aleatório, em localStorage. O PIN nunca é salvo em texto puro nem enviado a nenhum servidor.</p>
        <p><strong>Limitações:</strong> qualquer pessoa com acesso a este navegador pode apagar o localStorage e contornar o PIN. Use também bloqueio do sistema operacional.</p>
      </div>
    </PageContainer>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
      <Switch checked={checked} onCheckedChange={onChange} />
      <span className="text-sm leading-tight">{label}</span>
    </label>
  );
}
