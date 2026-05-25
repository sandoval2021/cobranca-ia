import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Building2, Clock, Wallet, Tags, ShieldCheck, Save, RotateCcw,
  Download, Upload, Copy, Info,
} from "lucide-react";

import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  DEFAULT_REVENDA_SETTINGS, REVENDA_PREVIEW_TEMPLATES, REVENDA_SETTINGS_EVENT,
  exportRevendaSettings, getRevendaSettings, importRevendaSettings,
  renderRevendaPreview, resetRevendaSettings, saveRevendaSettings,
  type RevendaSettings,
} from "@/lib/revenda-settings";

export const Route = createFileRoute("/configuracoes-revenda")({
  head: () => ({
    meta: [
      { title: "Minha Revenda — Cobrança IA" },
      { name: "description", content: "Configure os dados usados nas mensagens, cobranças e atendimento." },
    ],
  }),
  component: ConfiguracoesRevendaPage,
});

function ConfiguracoesRevendaPage() {
  const [settings, setSettings] = useState<RevendaSettings>(() => getRevendaSettings());
  const [dirty, setDirty] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = () => setSettings(getRevendaSettings());
    window.addEventListener(REVENDA_SETTINGS_EVENT, handler);
    return () => window.removeEventListener(REVENDA_SETTINGS_EVENT, handler);
  }, []);

  const update = useCallback(<K extends keyof RevendaSettings>(section: K, patch: Partial<RevendaSettings[K]>) => {
    setSettings((prev) => ({ ...prev, [section]: { ...(prev[section] as any), ...patch } }));
    setDirty(true);
  }, []);

  const handleSave = useCallback(() => {
    const saved = saveRevendaSettings(settings);
    setSettings(saved);
    setDirty(false);
    toast.success("Configurações salvas localmente.");
  }, [settings]);

  const handleReset = useCallback(() => {
    const def = resetRevendaSettings();
    setSettings(def);
    setDirty(false);
    setConfirmReset(false);
    toast.success("Configurações restauradas para o padrão.");
  }, []);

  const handleExport = useCallback(() => {
    try {
      const name = exportRevendaSettings();
      toast.success(`Exportado: ${name}`);
    } catch {
      toast.error("Não foi possível exportar.");
    }
  }, []);

  const handleImport = useCallback(async (file: File) => {
    try {
      const next = await importRevendaSettings(file);
      setSettings(next);
      setDirty(false);
      toast.success("Configurações importadas.");
    } catch {
      toast.error("Arquivo inválido. Verifique o JSON.");
    }
  }, []);

  const previews = useMemo(
    () => REVENDA_PREVIEW_TEMPLATES.map((t) => ({ ...t, rendered: renderRevendaPreview(t.id, settings) })),
    [settings],
  );

  const copyPreview = useCallback((text: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(
      () => toast.success("Exemplo copiado."),
      () => toast.error("Não foi possível copiar."),
    );
  }, []);

  return (
    <PageContainer>
      <SectionHeader
        title="Minha Revenda"
        description="Configure os dados usados nas mensagens, cobranças e atendimento."
      />

      <div className="rounded-lg border border-amber-300/40 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-900 dark:text-amber-200 flex gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Essas configurações são locais e não enviam nenhuma mensagem automaticamente.</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSave} disabled={!dirty} className="gap-2">
          <Save className="h-4 w-4" /> Salvar configurações
        </Button>
        <Button variant="outline" onClick={() => setConfirmReset(true)} className="gap-2">
          <RotateCcw className="h-4 w-4" /> Restaurar padrão
        </Button>
        <Button variant="outline" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" /> Exportar
        </Button>
        <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
          <Upload className="h-4 w-4" /> Importar
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
            e.target.value = "";
          }}
        />
      </div>

      {/* Seção 1 — Dados */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 font-medium"><Building2 className="h-4 w-4" /> Dados da revenda</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome da revenda" value={settings.dados.nome_revenda}
            onChange={(v) => update("dados", { nome_revenda: v })} />
          <Field label="Responsável" value={settings.dados.responsavel}
            onChange={(v) => update("dados", { responsavel: v })} />
          <Field label="WhatsApp de suporte" value={settings.dados.whatsapp_suporte}
            onChange={(v) => update("dados", { whatsapp_suporte: v })} placeholder="(DDD) 9 0000-0000" />
          <Field label="Cidade/estado" value={settings.dados.cidade}
            onChange={(v) => update("dados", { cidade: v })} />
          <Field label="Site/link (opcional)" value={settings.dados.site}
            onChange={(v) => update("dados", { site: v })} />
        </div>
        <TextField label="Observações internas" value={settings.dados.observacoes}
          onChange={(v) => update("dados", { observacoes: v })} />
      </Card>

      {/* Seção 2 — Atendimento */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 font-medium"><Clock className="h-4 w-4" /> Atendimento</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Horário segunda a sábado" value={settings.atendimento.horario_semana}
            onChange={(v) => update("atendimento", { horario_semana: v })} />
          <Field label="Horário domingo" value={settings.atendimento.horario_domingo}
            onChange={(v) => update("atendimento", { horario_domingo: v })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleRow label="Aceita áudio?" checked={settings.atendimento.aceita_audio}
            onChange={(v) => update("atendimento", { aceita_audio: v })} />
          <ToggleRow label="Aceita ligação?" checked={settings.atendimento.aceita_ligacao}
            onChange={(v) => update("atendimento", { aceita_ligacao: v })} />
        </div>
        <TextField label="Texto para áudio" value={settings.atendimento.texto_audio}
          onChange={(v) => update("atendimento", { texto_audio: v })} />
        <TextField label="Texto fora do horário" value={settings.atendimento.texto_fora_horario}
          onChange={(v) => update("atendimento", { texto_fora_horario: v })} />
        <TextField label="Texto para pedir print" value={settings.atendimento.texto_pedir_print}
          onChange={(v) => update("atendimento", { texto_pedir_print: v })} />
        <TextField label="Texto para pedir nome do app" value={settings.atendimento.texto_pedir_nome_app}
          onChange={(v) => update("atendimento", { texto_pedir_nome_app: v })} />
      </Card>

      {/* Seção 3 — Pagamento */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 font-medium"><Wallet className="h-4 w-4" /> Pagamento</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Chave Pix" value={settings.pagamento.pix}
            onChange={(v) => update("pagamento", { pix: v })} />
          <Field label="Nome do recebedor" value={settings.pagamento.recebedor}
            onChange={(v) => update("pagamento", { recebedor: v })} />
          <Field label="Banco (opcional)" value={settings.pagamento.banco}
            onChange={(v) => update("pagamento", { banco: v })} />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <ToggleRow label="Aceita Pix" checked={settings.pagamento.aceita_pix}
            onChange={(v) => update("pagamento", { aceita_pix: v })} />
          <ToggleRow label="Aceita cartão" checked={settings.pagamento.aceita_cartao}
            onChange={(v) => update("pagamento", { aceita_cartao: v })} />
          <ToggleRow label="Aceita dinheiro" checked={settings.pagamento.aceita_dinheiro}
            onChange={(v) => update("pagamento", { aceita_dinheiro: v })} />
        </div>
        <TextField label="Observação de pagamento" value={settings.pagamento.observacao_pagamento}
          onChange={(v) => update("pagamento", { observacao_pagamento: v })} />
      </Card>

      {/* Seção 4 — Planos */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 font-medium"><Tags className="h-4 w-4" /> Planos e valores</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Plano mensal padrão" value={settings.planos.plano_mensal_padrao}
            onChange={(v) => update("planos", { plano_mensal_padrao: v })} />
          <Field label="Valor mensal padrão" value={settings.planos.valor_mensal}
            onChange={(v) => update("planos", { valor_mensal: v })} placeholder="R$ 30,00" />
          <Field label="Valor por tela extra" value={settings.planos.valor_tela_extra}
            onChange={(v) => update("planos", { valor_tela_extra: v })} placeholder="R$ 10,00" />
          <Field label="Valor app pago padrão" value={settings.planos.valor_app}
            onChange={(v) => update("planos", { valor_app: v })} />
          <Field label="Valor renovação app pago" value={settings.planos.valor_renovacao_app}
            onChange={(v) => update("planos", { valor_renovacao_app: v })} />
        </div>
        <TextField label="Texto curto dos planos" value={settings.planos.texto_planos}
          onChange={(v) => update("planos", { texto_planos: v })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleRow label="Promoção ativa?" checked={settings.planos.promocao_ativa}
            onChange={(v) => update("planos", { promocao_ativa: v })} />
          <Field label="Data fim da promoção" type="date" value={settings.planos.data_fim_promocao}
            onChange={(v) => update("planos", { data_fim_promocao: v })} />
        </div>
        <TextField label="Texto da promoção" value={settings.planos.texto_promocao}
          onChange={(v) => update("planos", { texto_promocao: v })} />
      </Card>

      {/* Seção 5 — Regras */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4" /> Regras operacionais</div>
        <ToggleRow label="Exigir aprovação manual" checked={settings.regras.exigir_aprovacao_manual}
          onChange={(v) => update("regras", { exigir_aprovacao_manual: v })} />
        <ToggleRow label="Nunca enviar mensagem real automaticamente" checked={settings.regras.bloquear_envio_automatico}
          onChange={(v) => update("regras", { bloquear_envio_automatico: v })} />
        <ToggleRow label="Separar app pago da mensalidade da lista" checked={settings.regras.separar_app_pago}
          onChange={(v) => update("regras", { separar_app_pago: v })} />
        <ToggleRow label="Recuperar cliente após 30 dias vencido" checked={settings.regras.recuperar_apos_30}
          onChange={(v) => update("regras", { recuperar_apos_30: v })} />
        <ToggleRow label="Cliente inativo após 60 dias vencido" checked={settings.regras.inativo_apos_60}
          onChange={(v) => update("regras", { inativo_apos_60: v })} />
      </Card>

      {/* Prévia de mensagens */}
      <Card className="p-4 space-y-3">
        <div className="font-medium">Prévia de mensagens</div>
        <div className="text-xs text-muted-foreground">
          Exemplos usando seus dados. Nada é enviado automaticamente.
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {previews.map((p) => (
            <Card key={p.id} className="p-3 space-y-2 bg-muted/30">
              <div className="text-sm font-medium">{p.label}</div>
              <div className="text-sm whitespace-pre-wrap leading-relaxed">{p.rendered}</div>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => copyPreview(p.rendered)}>
                <Copy className="h-3 w-3" /> Copiar exemplo
              </Button>
            </Card>
          ))}
        </div>
      </Card>

      {dirty ? (
        <div className="text-xs text-amber-600">Você tem alterações não salvas.</div>
      ) : null}

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar padrão?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai apagar suas configurações locais e voltar para o padrão sugerido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>Restaurar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

function Field({
  label, value, onChange, placeholder, type,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={value} type={type} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function TextField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Textarea value={value} rows={3} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ToggleRow({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border p-2">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

// silence unused default warning
void DEFAULT_REVENDA_SETTINGS;
