import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  MessageCircle,
  Sparkles,
  Lock,
  AlertTriangle,
  Loader2,
  Plus,
  X,
  CalendarClock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Search,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { HelpTip } from "@/components/ui-premium/HelpTip";
import { EmptyState } from "@/components/ui-premium/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { flags } from "@/lib/flags";
import { supabase, supabaseConfigured } from "@/integrations/supabase/compat";
import { useAuth } from "@/lib/use-auth";
import {
  getCurrentCompanyAdmin,
  listChargesForSelectAdmin,
} from "@/lib/rpc-admin";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/configuracoes")({ component: ConfiguracoesPage });

// ---------- helpers ----------
type Row = Record<string, unknown>;

type Tone = "amigavel" | "firme" | "curto" | "lembrete";

const TONE_LABEL: Record<Tone, string> = {
  amigavel: "Amigável",
  firme: "Firme",
  curto: "Curto",
  lembrete: "Lembrete",
};

const WEEKDAYS = [
  { n: 0, label: "Domingo" },
  { n: 1, label: "Segunda" },
  { n: 2, label: "Terça" },
  { n: 3, label: "Quarta" },
  { n: 4, label: "Quinta" },
  { n: 5, label: "Sexta" },
  { n: 6, label: "Sábado" },
];

type Settings = {
  enabled: boolean;
  simulation_mode: boolean;
  default_tone: Tone;
  days_before_due: number[];
  days_after_due: number[];
  max_attempts_per_charge: number;
  min_hours_between_attempts: number;
  quiet_hours_start: string; // "HH:MM"
  quiet_hours_end: string;
  allowed_weekdays: number[];
  prevent_duplicate_messages: boolean;
  allow_paid_charge_messages: boolean;
  allow_cancelled_charge_messages: boolean;
  require_manual_approval: boolean;
};

const DEFAULTS: Settings = {
  enabled: true,
  simulation_mode: true,
  default_tone: "amigavel",
  days_before_due: [3, 1],
  days_after_due: [1, 3, 7],
  max_attempts_per_charge: 5,
  min_hours_between_attempts: 24,
  quiet_hours_start: "21:00",
  quiet_hours_end: "08:00",
  allowed_weekdays: [1, 2, 3, 4, 5],
  prevent_duplicate_messages: true,
  allow_paid_charge_messages: false,
  allow_cancelled_charge_messages: false,
  require_manual_approval: true,
};

function asNumArr(v: unknown): number[] {
  if (Array.isArray(v))
    return v
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x))
      .map((x) => Math.trunc(x));
  return [];
}

function normalizeTime(v: unknown, fallback: string): string {
  if (typeof v === "string" && /^\d{1,2}:\d{2}/.test(v)) {
    const [h, m] = v.split(":");
    return `${h.padStart(2, "0")}:${m.slice(0, 2)}`;
  }
  return fallback;
}

function normalizeTone(v: unknown): Tone {
  const s = String(v ?? "").toLowerCase();
  if (s === "firme" || s === "curto" || s === "lembrete") return s;
  return "amigavel";
}

function fromRpc(raw: Row | null | undefined): Settings {
  const r = raw ?? {};
  return {
    enabled: Boolean(r.enabled ?? DEFAULTS.enabled),
    simulation_mode: Boolean(r.simulation_mode ?? DEFAULTS.simulation_mode),
    default_tone: normalizeTone(r.default_tone),
    days_before_due: r.days_before_due != null ? asNumArr(r.days_before_due) : DEFAULTS.days_before_due,
    days_after_due: r.days_after_due != null ? asNumArr(r.days_after_due) : DEFAULTS.days_after_due,
    max_attempts_per_charge: Number(r.max_attempts_per_charge ?? DEFAULTS.max_attempts_per_charge),
    min_hours_between_attempts: Number(r.min_hours_between_attempts ?? DEFAULTS.min_hours_between_attempts),
    quiet_hours_start: normalizeTime(r.quiet_hours_start, DEFAULTS.quiet_hours_start),
    quiet_hours_end: normalizeTime(r.quiet_hours_end, DEFAULTS.quiet_hours_end),
    allowed_weekdays: r.allowed_weekdays != null ? asNumArr(r.allowed_weekdays) : DEFAULTS.allowed_weekdays,
    prevent_duplicate_messages: Boolean(r.prevent_duplicate_messages ?? DEFAULTS.prevent_duplicate_messages),
    allow_paid_charge_messages: Boolean(r.allow_paid_charge_messages ?? DEFAULTS.allow_paid_charge_messages),
    allow_cancelled_charge_messages: Boolean(r.allow_cancelled_charge_messages ?? DEFAULTS.allow_cancelled_charge_messages),
    require_manual_approval: Boolean(r.require_manual_approval ?? DEFAULTS.require_manual_approval),
  };
}

function friendlyErr(msg: string): string {
  const m = (msg || "").toLowerCase();
  if (m.includes("permission") || m.includes("denied") || m.includes("rls") || m.includes("not allowed"))
    return "Você não tem permissão para esta ação.";
  if (m.includes("network") || m.includes("fetch")) return "Falha de conexão. Tente novamente.";
  return msg || "Erro inesperado.";
}

function fmtBRL(cents: number | null): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ---------- page ----------
function ConfiguracoesPage() {
  return (
    <PageContainer>
      <SectionHeader title="Configurações" subtitle="Regras de cobrança e estado das integrações" />
      <CollectionRulesBlock />
      <div className="mt-8">
        <h2 className="mb-2 text-sm font-semibold">Estado das integrações</h2>
        <div className="space-y-2">
          <IntegrationBlock
            icon={CreditCard}
            title="Pagamentos reais"
            desc="Bloqueado nesta etapa. Nenhuma cobrança é enviada para gateways reais."
            active={flags.allowRealPayments}
          />
          <IntegrationBlock
            icon={MessageCircle}
            title="WhatsApp real"
            desc="Bloqueado nesta etapa. Nenhuma mensagem real é enviada."
            active={flags.allowRealWhatsapp}
          />
          <IntegrationBlock
            icon={Sparkles}
            title="IA real livre"
            desc="Bloqueada nesta etapa. A IA não envia chamadas externas."
            active={flags.allowRealAi}
          />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Para liberar as integrações reais, ajuste as variáveis de ambiente correspondentes no Lovable.
        </p>
      </div>
    </PageContainer>
  );
}

function IntegrationBlock({
  icon: Icon, title, desc, active,
}: { icon: LucideIcon; title: string; desc: string; active: boolean }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-muted text-foreground/60">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
      <span className={"shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium " +
        (active ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
        <Lock className="h-3 w-3" />
        {active ? "Ativo" : "Bloqueado"}
      </span>
    </div>
  );
}

// ---------- regras de cobrança ----------
function CollectionRulesBlock() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [settingsErr, setSettingsErr] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saveTechDetail, setSaveTechDetail] = useState<string | null>(null);

  // Resolve company
  useEffect(() => {
    if (authLoading) return;
    if (!supabaseConfigured || !supabase) {
      setLoadingCompany(false);
      setLoadErr("Conexão não configurada.");
      return;
    }
    if (!isAuthenticated) {
      setLoadingCompany(false);
      return;
    }
    let alive = true;
    (async () => {
      const { companyId: id, error } = await getCurrentCompanyAdmin();
      if (!alive) return;
      if (error) {
        setLoadErr(friendlyErr(error.message ?? ""));
        setLoadingCompany(false);
        return;
      }
      if (!id) {
        setLoadErr("Nenhuma empresa autorizada encontrada.");
        setLoadingCompany(false);
        return;
      }
      setCompanyId(id);
      setLoadingCompany(false);
    })();
    return () => { alive = false; };
  }, [authLoading, isAuthenticated]);

  // Load settings
  useEffect(() => {
    if (!companyId || !supabase) return;
    let alive = true;
    setLoadingSettings(true);
    setSettingsErr(null);
    (async () => {
      const { data, error } = await supabase!.rpc("get_collection_settings_admin", {
        p_company_id: companyId,
      });
      if (!alive) return;
      if (error) {
        setSettingsErr("Não foi possível carregar as regras agora.");
        setSettings(fromRpc(null));
        setLoadingSettings(false);
        return;
      }
      const raw = (Array.isArray(data) ? data[0] : data) as Row | null;
      setSettings(fromRpc(raw));
      setLoadingSettings(false);
    })();
    return () => { alive = false; };
  }, [companyId]);

  const update = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setSettings((s) => (s ? { ...s, [k]: v } : s));
    setSavedAt(null);
  };

  const onSave = async () => {
    if (!settings || !companyId || !supabase) return;

    // ---- normalizar horários -> HH:mm:ss | null
    const toHMS = (v: string | null | undefined): string | null => {
      if (v == null) return null;
      const s = String(v).trim();
      if (!s) return null;
      const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (!m) return null;
      const hh = m[1].padStart(2, "0");
      const mm = m[2];
      const ss = m[3] ?? "00";
      const hN = Number(hh), mN = Number(mm), sN = Number(ss);
      if (hN > 23 || mN > 59 || sN > 59) return null;
      return `${hh}:${mm}:${ss}`;
    };

    const tones: Tone[] = ["amigavel", "firme", "curto", "lembrete"];
    const validTone = tones.includes(settings.default_tone) ? settings.default_tone : "amigavel";

    const daysBefore = settings.days_before_due.filter((n) => Number.isInteger(n) && n >= 0);
    const daysAfter = settings.days_after_due.filter((n) => Number.isInteger(n) && n >= 0);
    const weekdays = settings.allowed_weekdays.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
    const maxAttempts = Math.trunc(Number(settings.max_attempts_per_charge));
    const minHours = Math.trunc(Number(settings.min_hours_between_attempts));
    const qhStart = toHMS(settings.quiet_hours_start);
    const qhEnd = toHMS(settings.quiet_hours_end);

    setSaveErr(null);
    setSaveTechDetail(null);
    setSavedAt(null);

    if (
      !companyId ||
      !(maxAttempts >= 1 && maxAttempts <= 10) ||
      !(minHours >= 1 && minHours <= 168) ||
      (settings.quiet_hours_start && qhStart === null) ||
      (settings.quiet_hours_end && qhEnd === null)
    ) {
      setSaveErr("Revise os campos destacados antes de salvar.");
      return;
    }

    setSaving(true);

    const payload = {
      p_company_id: companyId,
      p_enabled: Boolean(settings.enabled),
      p_simulation_mode: true,
      p_default_tone: validTone,
      p_days_before_due: daysBefore,
      p_days_after_due: daysAfter,
      p_max_attempts_per_charge: maxAttempts,
      p_min_hours_between_attempts: minHours,
      p_quiet_hours_start: qhStart,
      p_quiet_hours_end: qhEnd,
      p_allowed_weekdays: weekdays,
      p_prevent_duplicate_messages: Boolean(settings.prevent_duplicate_messages),
      p_allow_paid_charge_messages: Boolean(settings.allow_paid_charge_messages),
      p_allow_cancelled_charge_messages: Boolean(settings.allow_cancelled_charge_messages),
      p_require_manual_approval: true,
    };

    const { data, error } = await supabase.rpc("upsert_collection_settings_admin", payload);
    setSaving(false);

    if (error) {
      const friendly = friendlyErr(error.message);
      setSaveErr(
        friendly.includes("permissão")
          ? "Você não tem permissão para alterar estas regras."
          : "Não foi possível salvar as regras agora.",
      );
      const e = error as { message?: string; details?: string; hint?: string; code?: string };
      const parts = [
        e.message && `mensagem: ${e.message}`,
        e.details && `detalhe: ${e.details}`,
        e.hint && `dica: ${e.hint}`,
        e.code && `código: ${e.code}`,
      ].filter(Boolean) as string[];
      if (flags.appEnv !== "production" && parts.length) {
        setSaveTechDetail(parts.join(" · "));
      }
      // log seguro (sem segredos)
      console.warn("[upsert_collection_settings_admin] falhou:", parts.join(" | "));
      return;
    }

    // sucesso — atualiza estado local com retorno (se houver) e mantém travas
    const raw = (Array.isArray(data) ? data[0] : data) as Row | null;
    const next = raw ? fromRpc(raw) : { ...settings };
    setSettings({ ...next, simulation_mode: true, require_manual_approval: true });
    setSavedAt(Date.now());

    // recarrega do servidor para garantir persistência
    try {
      const reload = await supabase.rpc("get_collection_settings_admin", { p_company_id: companyId });
      if (!reload.error) {
        const r = (Array.isArray(reload.data) ? reload.data[0] : reload.data) as Row | null;
        const fresh = fromRpc(r);
        setSettings({ ...fresh, simulation_mode: true, require_manual_approval: true });
      }
    } catch {
      // silencioso: já mostramos sucesso
    }
  };

  // States
  if (authLoading || loadingCompany) {
    return (
      <SectionCard title="Regras de cobrança" subtitle="Defina como o sistema deve simular cobranças antes de qualquer envio real.">
        <StagingNotice />
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      </SectionCard>
    );
  }

  if (!isAuthenticated) {
    return (
      <SectionCard title="Regras de cobrança" subtitle="Defina como o sistema deve simular cobranças antes de qualquer envio real.">
        <EmptyState icon={Lock} title="Acesso restrito" description="Entre com sua conta para configurar as regras." />
      </SectionCard>
    );
  }

  if (loadErr || !companyId) {
    return (
      <SectionCard title="Regras de cobrança" subtitle="Defina como o sistema deve simular cobranças antes de qualquer envio real.">
        <EmptyState icon={AlertTriangle} title="Não foi possível carregar" description={loadErr ?? "Empresa não encontrada."} />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Regras de cobrança" subtitle="Defina como o sistema deve simular cobranças antes de qualquer envio real.">
      <StagingNotice />
      {loadingSettings || !settings ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      ) : (
        <div className="space-y-6">
          {settingsErr && (
            <div className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
              {settingsErr}
            </div>
          )}

          {/* Automação */}
          <FieldRow
            label="Ativar regras de cobrança"
            help="Ativa as regras para simulação. Em staging, nada será enviado automaticamente."
            control={
              <Switch checked={settings.enabled} onCheckedChange={(v) => update("enabled", Boolean(v))} />
            }
          />

          <FieldRow
            label="Modo de testes"
            badge="Sempre ativo em staging"
            help="Mantém todas as ações em modo seguro, sem envio real."
            control={<Switch checked disabled />}
          />

          <FieldRow
            label="Aprovação manual obrigatória"
            badge="Sempre ativa em staging"
            help="Exige confirmação manual antes de qualquer ação. Em staging, isso fica sempre ativo."
            control={<Switch checked disabled />}
          />

          {/* Tom */}
          <Field label="Tom padrão" help="Tom usado nas mensagens simuladas por padrão.">
            <Select value={settings.default_tone} onValueChange={(v) => update("default_tone", v as Tone)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TONE_LABEL) as Tone[]).map((t) => (
                  <SelectItem key={t} value={t}>{TONE_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* Dias antes/depois */}
          <Field label="Dias antes do vencimento" help="Define quantos dias antes do vencimento o sistema deve simular lembretes.">
            <DayChips
              kind="before"
              values={settings.days_before_due}
              onChange={(v) => update("days_before_due", v)}
            />
          </Field>

          <Field label="Dias depois do vencimento" help="Define quantos dias após o vencimento o sistema deve simular cobranças.">
            <DayChips
              kind="after"
              values={settings.days_after_due}
              onChange={(v) => update("days_after_due", v)}
            />
          </Field>

          {/* Numéricos */}
          <Field label="Máximo de tentativas por cobrança" help="Evita cobrar o mesmo cliente muitas vezes.">
            <NumberInput
              min={1}
              max={10}
              value={settings.max_attempts_per_charge}
              onChange={(n) => update("max_attempts_per_charge", n)}
            />
          </Field>

          <Field label="Intervalo mínimo entre mensagens (horas)" help="Define o tempo mínimo entre uma tentativa e outra.">
            <NumberInput
              min={1}
              max={168}
              value={settings.min_hours_between_attempts}
              onChange={(n) => update("min_hours_between_attempts", n)}
            />
          </Field>

          {/* Horário */}
          <Field label="Horário permitido" help="Evita simular mensagens em horários ruins.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">Não incomodar a partir de</Label>
                <Input
                  type="time"
                  value={settings.quiet_hours_start}
                  onChange={(e) => update("quiet_hours_start", e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">Voltar a permitir a partir de</Label>
                <Input
                  type="time"
                  value={settings.quiet_hours_end}
                  onChange={(e) => update("quiet_hours_end", e.target.value)}
                />
              </div>
            </div>
          </Field>

          {/* Dias da semana */}
          <Field label="Dias da semana permitidos" help="Selecione os dias em que o sistema pode simular mensagens.">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {WEEKDAYS.map((w) => {
                const checked = settings.allowed_weekdays.includes(w.n);
                return (
                  <label
                    key={w.n}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        const set = new Set(settings.allowed_weekdays);
                        if (v) set.add(w.n);
                        else set.delete(w.n);
                        update("allowed_weekdays", Array.from(set).sort((a, b) => a - b));
                      }}
                    />
                    <span>{w.label}</span>
                  </label>
                );
              })}
            </div>
          </Field>

          {/* Switches finais */}
          <FieldRow
            label="Evitar mensagens repetidas"
            help="Evita gerar a mesma cobrança várias vezes para o mesmo cliente."
            control={
              <Switch
                checked={settings.prevent_duplicate_messages}
                onCheckedChange={(v) => update("prevent_duplicate_messages", Boolean(v))}
              />
            }
          />
          <FieldRow
            label="Permitir mensagem para cobrança paga"
            help="Normalmente não é recomendado cobrar quem já pagou."
            control={
              <Switch
                checked={settings.allow_paid_charge_messages}
                onCheckedChange={(v) => update("allow_paid_charge_messages", Boolean(v))}
              />
            }
          />
          <FieldRow
            label="Permitir mensagem para cobrança cancelada"
            help="Evita contato indevido em cobranças canceladas."
            control={
              <Switch
                checked={settings.allow_cancelled_charge_messages}
                onCheckedChange={(v) => update("allow_cancelled_charge_messages", Boolean(v))}
              />
            }
          />

          {/* Save */}
          <div className="sticky bottom-2 z-10 -mx-1 flex flex-col gap-2 rounded-xl border border-border bg-card/95 p-3 shadow-card backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-xs">
              {saveErr ? (
                <div className="space-y-1">
                  <span className="text-danger">{saveErr}</span>
                  {saveTechDetail && (
                    <details className="text-[11px] text-muted-foreground">
                      <summary className="cursor-pointer">Detalhe técnico (staging)</summary>
                      <p className="mt-1 break-all">{saveTechDetail}</p>
                    </details>
                  )}
                </div>
              ) : savedAt ? (
                <span className="inline-flex items-center gap-1 text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Regras de cobrança salvas com sucesso.
                </span>
              ) : (
                <span className="text-muted-foreground">As alterações só valem após salvar.</span>
              )}
            </div>
            <Button onClick={onSave} disabled={saving} className="sm:min-w-[160px]">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Salvando…" : "Salvar regras"}
            </Button>
          </div>
        </div>
      )}

      {/* Prévia */}
      <SchedulePreview companyId={companyId} />
    </SectionCard>
  );
}

// ---------- subcomponents ----------
function SectionCard({
  title, subtitle, children,
}: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
      <div className="mb-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function StagingNotice() {
  if (!flags.stagingMode) return null;
  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        <span className="font-semibold">Ambiente de testes:</span> nenhuma cobrança real, WhatsApp real, pagamento real ou IA real será executada.
      </p>
    </div>
  );
}

function Field({
  label, help, children,
}: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">{label}</Label>
        {help && <HelpTip text={help} />}
      </div>
      {children}
    </div>
  );
}

function FieldRow({
  label, help, badge, control,
}: { label: string; help?: string; badge?: string; control: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-muted/40 px-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-sm font-medium">{label}</Label>
          {help && <HelpTip text={help} />}
          {badge && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-medium text-primary">
              <Lock className="h-3 w-3" /> {badge}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function NumberInput({
  value, min, max, onChange,
}: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.trunc(n)));
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="icon"
        variant="outline"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        aria-label="Diminuir"
      >
        <span className="text-lg leading-none">−</span>
      </Button>
      <Input
        type="number"
        inputMode="numeric"
        className="w-24 text-center"
        value={Number.isFinite(value) ? value : min}
        min={min}
        max={max}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
      />
      <Button
        type="button"
        size="icon"
        variant="outline"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label="Aumentar"
      >
        <span className="text-lg leading-none">+</span>
      </Button>
      <span className="text-xs text-muted-foreground">de {min} a {max}</span>
    </div>
  );
}

function DayChips({
  kind, values, onChange,
}: { kind: "before" | "after"; values: number[]; onChange: (v: number[]) => void }) {
  const [input, setInput] = useState("");
  const sorted = useMemo(() => [...values].sort((a, b) => a - b), [values]);

  const add = (raw: string) => {
    const n = Math.trunc(Number(raw));
    if (!Number.isFinite(n) || n < 1 || n > 365) return;
    if (values.includes(n)) {
      setInput("");
      return;
    }
    onChange([...values, n].sort((a, b) => a - b));
    setInput("");
  };

  const remove = (n: number) => onChange(values.filter((x) => x !== n));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {sorted.length === 0 && (
          <span className="text-xs text-muted-foreground">Nenhum dia configurado.</span>
        )}
        {sorted.map((n) => (
          <span
            key={n}
            className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary"
          >
            {n} {n === 1 ? "dia" : "dias"} {kind === "before" ? "antes" : "depois"}
            <button
              type="button"
              onClick={() => remove(n)}
              className="rounded-full p-0.5 hover:bg-primary/10"
              aria-label="Remover"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={365}
          placeholder="Ex: 3"
          className="w-28"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(input);
            }
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => add(input)}>
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>
    </div>
  );
}

// ---------- prévia ----------
type ChargeLite = {
  id: string;
  customer_name: string;
  whatsapp: string | null;
  amount_cents: number | null;
  due_date: string | null;
  status: string | null;
};

type PreviewItem = {
  scheduled_at: string | null;
  relation: string | null;
  reason: string | null;
  tone: string | null;
  allowed: boolean;
  blocked_reason: string | null;
};

function normalizePreview(r: Row): PreviewItem {
  const allowedRaw = r.allowed ?? r.is_allowed ?? r.permitted;
  return {
    scheduled_at: (r.scheduled_at as string) ?? (r.scheduled_for as string) ?? (r.run_at as string) ?? null,
    relation: (r.relation as string) ?? (r.relative_to_due as string) ?? null,
    reason: (r.reason as string) ?? (r.motivo as string) ?? null,
    tone: (r.tone as string) ?? null,
    allowed: Boolean(allowedRaw ?? true),
    blocked_reason: (r.blocked_reason as string) ?? (r.block_reason as string) ?? (r.motivo_bloqueio as string) ?? null,
  };
}

function SchedulePreview({ companyId }: { companyId: string }) {
  const [loadingList, setLoadingList] = useState(true);
  const [charges, setCharges] = useState<ChargeLite[]>([]);
  const [listErr, setListErr] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [items, setItems] = useState<PreviewItem[] | null>(null);

  useEffect(() => {
    if (!supabase || !companyId) return;
    let alive = true;
    (async () => {
      setLoadingList(true);
      setListErr(null);
      const res = await listChargesForSelectAdmin({
        p_company_id: companyId,
        p_status: null,
        p_limit: 100,
      });
      if (!alive) return;
      if (res.error) {
        setListErr("Não foi possível carregar as cobranças agora.");
        setLoadingList(false);
        return;
      }
      const rows = (res.data ?? []) as Row[];
      const list: ChargeLite[] = rows.map((r) => {
        const amount =
          r.amount_cents != null
            ? Number(r.amount_cents)
            : r.amount != null
              ? Math.round(Number(r.amount) * 100)
              : null;
        return {
          id: String(r.id ?? r.charge_id ?? ""),
          customer_name:
            (r.customer_name as string) ??
            (r.name as string) ??
            (r.nome as string) ??
            "Cliente",
          whatsapp:
            (r.whatsapp_e164 as string) ??
            (r.whatsapp as string) ??
            (r.phone as string) ??
            (r.telefone as string) ??
            null,
          amount_cents: Number.isFinite(amount) ? amount : null,
          due_date: (r.due_date as string) ?? null,
          status: (r.status as string) ?? null,
        };
      });
      setCharges(list);
      setLoadingList(false);
    })();
    return () => { alive = false; };
  }, [companyId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return charges.slice(0, 20);
    return charges
      .filter((c) => {
        const name = c.customer_name.toLowerCase();
        const phone = (c.whatsapp ?? "").replace(/\D+/g, "");
        const qd = q.replace(/\D+/g, "");
        return name.includes(q) || (qd && phone.includes(qd)) || (c.status ?? "").toLowerCase().includes(q);
      })
      .slice(0, 20);
  }, [query, charges]);

  const selected = useMemo(
    () => charges.find((c) => c.id === selectedId) ?? null,
    [charges, selectedId],
  );

  const runPreview = async () => {
    if (!selectedId || !supabase) return;
    setRunning(true);
    setPreviewErr(null);
    setItems(null);
    const { data, error } = await supabase.rpc("preview_collection_schedule_admin", {
      p_company_id: companyId,
      p_charge_id: selectedId,
    });
    setRunning(false);
    if (error) {
      setPreviewErr("Não foi possível gerar a prévia agora.");
      return;
    }
    const arr = Array.isArray(data) ? data : data ? [data] : [];
    setItems((arr as Row[]).map(normalizePreview));
  };

  return (
    <div className="mt-6 border-t border-border pt-5">
      <div className="mb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClock className="h-4 w-4" /> Prévia da agenda
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Veja como o sistema agendaria simulações para uma cobrança, sem enviar nada.
        </p>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, WhatsApp ou status…"
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {loadingList ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : listErr ? (
          <EmptyState icon={AlertTriangle} title="Erro" description={listErr} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Search} title="Nenhuma cobrança disponível" description="Cadastre uma cobrança para gerar a prévia." />
        ) : (
          <div className="grid max-h-72 gap-2 overflow-y-auto">
            {filtered.map((c) => {
              const isSel = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={
                    "flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors " +
                    (isSel
                      ? "border-primary bg-primary-soft"
                      : "border-border bg-card hover:bg-surface-muted")
                  }
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.customer_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.whatsapp ?? "Sem contato"} · {fmtBRL(c.amount_cents)} · venc. {fmtDate(c.due_date)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {c.status ?? "—"}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {selected ? (
              <>Selecionada: <span className="font-medium text-foreground">{selected.customer_name}</span></>
            ) : (
              "Selecione uma cobrança para gerar a prévia."
            )}
          </div>
          <Button onClick={runPreview} disabled={!selectedId || running}>
            {running && <Loader2 className="h-4 w-4 animate-spin" />}
            {running ? "Gerando…" : "Gerar prévia"}
          </Button>
        </div>

        {previewErr && (
          <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
            {previewErr}
          </div>
        )}

        {items && (
          <div className="space-y-2">
            {items.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="Sem agendamentos previstos"
                description="As regras atuais não geram nenhum disparo simulado para esta cobrança."
              />
            ) : (
              items.map((it, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-card p-3 shadow-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{fmtDateTime(it.scheduled_at)}</p>
                      <p className="text-xs text-muted-foreground">
                        {it.relation ?? "—"}
                        {it.tone ? ` · ${TONE_LABEL[normalizeTone(it.tone)]}` : ""}
                      </p>
                    </div>
                    <span
                      className={
                        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium " +
                        (it.allowed
                          ? "bg-success-soft text-success"
                          : "bg-danger-soft text-danger")
                      }
                    >
                      {it.allowed ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {it.allowed ? "Permitido" : "Bloqueado"}
                    </span>
                  </div>
                  {it.reason && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Motivo:</span> {it.reason}
                    </p>
                  )}
                  {!it.allowed && it.blocked_reason && (
                    <p className="mt-1 text-xs text-danger">
                      <span className="font-medium">Bloqueio:</span> {it.blocked_reason}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-dashed border-border bg-surface-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-xs text-muted-foreground">
            <p className="text-sm font-medium text-foreground">Fila simulada</p>
            <p>Veja todas as cobranças planejadas pelo sistema antes de qualquer envio real.</p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link to="/fila-simulada">Abrir fila simulada</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
