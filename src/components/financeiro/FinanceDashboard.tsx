import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Users, UserCheck, UserX, UserPlus, Wallet, CalendarRange,
} from "lucide-react";
import {
  listFinanceEntries, formatBRL, calculateFinanceSummary, FINANCE_EVENT,
  type FinanceEntry,
} from "@/lib/financeiro-local";
import { supabase, supabaseConfigured } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { getActiveAccountId, listCustomersAdmin } from "@/lib/rpc-admin";

type CustomerLite = {
  id: string;
  status: string | null;
  due_day: number | null;
  amount_cents: number | null;
  created_at: string | null;
};

function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function startOfWeek(d = new Date()) {
  const x = startOfDay(d); const day = x.getDay();
  x.setDate(x.getDate() - day); return x;
}
function startOfMonth(d = new Date()) {
  const x = startOfDay(d); x.setDate(1); return x;
}
function inRange(iso: string, from: Date, to?: Date) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  if (t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}

function nextDueFromDay(dueDay: number | null, ref = new Date()): Date | null {
  if (!dueDay || dueDay < 1 || dueDay > 31) return null;
  const y = ref.getFullYear(); const m = ref.getMonth();
  const d = new Date(y, m, Math.min(dueDay, new Date(y, m + 1, 0).getDate()));
  d.setHours(0,0,0,0);
  if (d.getTime() < startOfDay(ref).getTime()) {
    const d2 = new Date(y, m + 1, Math.min(dueDay, new Date(y, m + 2, 0).getDate()));
    d2.setHours(0,0,0,0);
    return d2;
  }
  return d;
}

export function FinanceDashboard() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [customers, setCustomers] = useState<CustomerLite[]>([]);

  useEffect(() => {
    const load = () => setEntries(listFinanceEntries());
    load();
    window.addEventListener(FINANCE_EVENT, load);
    return () => window.removeEventListener(FINANCE_EVENT, load);
  }, []);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !supabaseConfigured || !supabase) return;
    let alive = true;
    (async () => {
      const { accountId } = await getActiveAccountId();
      if (!accountId) return;
      const res = await listCustomersAdmin({
        p_company_id: accountId, p_status: null, p_search: null, p_limit: 500, p_offset: 0,
      });
      if (!alive || res.error) return;
      const raw = res.data as unknown;
      const arr = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { customers?: unknown[] } | null)?.customers)
          ? (raw as { customers: unknown[] }).customers
          : [];
      const list: CustomerLite[] = (arr as Record<string, unknown>[]).map((r) => ({
        id: String(r.id ?? ""),
        status: (r.status as string) ?? null,
        due_day: (r.due_day as number) ?? null,
        amount_cents: (typeof r.amount_cents === "number" ? r.amount_cents : null)
          ?? (typeof r.amount === "number" ? Math.round((r.amount as number) * 100) : null),
        created_at: (r.created_at as string) ?? null,
      }));
      setCustomers(list);
    })();
    return () => { alive = false; };
  }, [isAuthenticated, authLoading]);

  // Aggregations on finance entries
  const periods = useMemo(() => {
    const today = startOfDay(); const wk = startOfWeek(); const mo = startOfMonth();
    const today6 = (() => { const a = new Date(today); a.setDate(a.getDate() + 1); return a; })();
    const filt = (from: Date, to?: Date) =>
      entries.filter((e) => inRange(e.date, from, to));
    const sumRev = (xs: FinanceEntry[]) => xs.reduce((a, b) => a + b.amount_received, 0);
    const sumProfit = (xs: FinanceEntry[]) => xs.reduce((a, b) => a + b.net_profit, 0);
    const todayList = filt(today, today6);
    const weekList = filt(wk);
    const monthList = filt(mo);
    const renovHoje = todayList.filter((e) => e.type === "renovacao_lista" || e.type === "renovacao_app").length;
    return {
      apuradoHoje: sumRev(todayList),
      lucroHoje: sumProfit(todayList),
      apuradoSemana: sumRev(weekList),
      apuradoMes: sumRev(monthList),
      lucroMes: sumProfit(monthList),
      renovHoje,
      renovSemana: weekList.filter((e) => e.type === "renovacao_lista" || e.type === "renovacao_app").length,
      renovMes: monthList.filter((e) => e.type === "renovacao_lista" || e.type === "renovacao_app").length,
    };
  }, [entries]);

  // Clients KPIs
  const clientStats = useMemo(() => {
    const today = startOfDay(); const wk = startOfWeek(); const mo = startOfMonth();
    const next7 = (() => { const a = new Date(today); a.setDate(a.getDate() + 7); return a; })();
    const endMonth = (() => {
      const a = new Date(today); a.setMonth(a.getMonth() + 1); a.setDate(0); a.setHours(23,59,59,999); return a;
    })();
    let ativos = 0, vencidos = 0;
    let estHoje = 0, estSemana = 0, estMes = 0;
    let novosHoje = 0, novosSemana = 0, novosMes = 0;
    for (const c of customers) {
      const st = (c.status ?? "").toLowerCase();
      if (/ativ|active/.test(st)) ativos++;
      else if (/expir|venc|atras/.test(st)) vencidos++;
      const due = nextDueFromDay(c.due_day);
      const val = c.amount_cents ?? 0;
      if (due) {
        if (due.getTime() === today.getTime()) estHoje += val;
        if (due.getTime() <= next7.getTime()) estSemana += val;
        if (due.getTime() <= endMonth.getTime()) estMes += val;
      }
      if (c.created_at) {
        const t = new Date(c.created_at).getTime();
        if (t >= today.getTime()) novosHoje++;
        if (t >= wk.getTime()) novosSemana++;
        if (t >= mo.getTime()) novosMes++;
      }
    }
    return { ativos, vencidos, estHoje, estSemana, estMes, novosHoje, novosSemana, novosMes };
  }, [customers]);

  // Last 6 months series for comparativo
  const series = useMemo(() => {
    const months: { key: string; label: string; revenue: number; profit: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      months.push({ key, label, revenue: 0, profit: 0 });
    }
    for (const e of entries) {
      const d = new Date(e.date);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const m = months.find((x) => x.key === key);
      if (!m) continue;
      m.revenue += e.amount_received;
      m.profit += e.net_profit;
    }
    return months;
  }, [entries]);

  const maxSerie = Math.max(1, ...series.map((s) => Math.max(s.revenue, s.profit)));
  const lastTwo = series.slice(-2);
  const diffPct = (() => {
    if (lastTwo.length < 2 || lastTwo[0].revenue === 0) return null;
    return ((lastTwo[1].revenue - lastTwo[0].revenue) / lastTwo[0].revenue) * 100;
  })();

  return (
    <div className="space-y-4 mb-4">
      {/* Apurado hoje + renovações */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Kpi icon={<Wallet className="h-4 w-4" />} label="Apurado hoje" value={formatBRL(periods.apuradoHoje)}
          hint={`Lucro ${formatBRL(periods.lucroHoje)} • ${periods.renovHoje} renovação(ões)`} />
        <Kpi icon={<CalendarRange className="h-4 w-4" />} label="Apurado semana" value={formatBRL(periods.apuradoSemana)}
          hint={`${periods.renovSemana} renovações`} />
        <Kpi icon={<CalendarRange className="h-4 w-4" />} label="Apurado mês" value={formatBRL(periods.apuradoMes)}
          hint={`Lucro ${formatBRL(periods.lucroMes)} • ${periods.renovMes} renovações`} />
        <Kpi
          icon={diffPct != null && diffPct >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          label="vs mês anterior"
          value={diffPct == null ? "—" : `${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(1)}%`}
          accent={diffPct == null ? "" : diffPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}
          hint="Comparativo de receita"
        />
      </div>

      {/* Estimativas a receber */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Kpi icon={<Wallet className="h-4 w-4" />} label="Estimativa hoje" value={formatBRL(clientStats.estHoje / 100)} hint="Vencimentos do dia" />
        <Kpi icon={<Wallet className="h-4 w-4" />} label="Estimativa 7 dias" value={formatBRL(clientStats.estSemana / 100)} hint="A vencer nesta semana" />
        <Kpi icon={<Wallet className="h-4 w-4" />} label="Estimativa do mês" value={formatBRL(clientStats.estMes / 100)} hint="A vencer até fim do mês" />
        <Kpi icon={<UserPlus className="h-4 w-4" />} label="Novos clientes (mês)" value={String(clientStats.novosMes)}
          hint={`Hoje ${clientStats.novosHoje} • Semana ${clientStats.novosSemana}`} />
      </div>

      {/* Base de clientes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Kpi icon={<UserCheck className="h-4 w-4 text-emerald-600" />} label="Clientes ativos" value={String(clientStats.ativos)} accent="text-emerald-600 dark:text-emerald-400" />
        <Kpi icon={<UserX className="h-4 w-4 text-amber-600" />} label="Clientes vencidos" value={String(clientStats.vencidos)} accent="text-amber-600 dark:text-amber-400" />
        <Kpi icon={<Users className="h-4 w-4" />} label="Base total" value={String(customers.length)} />
        <Kpi icon={<UserPlus className="h-4 w-4" />} label="Novos hoje" value={String(clientStats.novosHoje)} />
      </div>

      {/* Gráfico comparativo 6 meses */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold">Últimos 6 meses — Receita x Lucro</h4>
          <span className="text-[11px] text-muted-foreground">Cinza: receita • Verde: lucro</span>
        </div>
        <div className="grid grid-cols-6 gap-2 items-end h-40">
          {series.map((m) => {
            const rh = Math.max(2, (m.revenue / maxSerie) * 100);
            const ph = Math.max(0, (m.profit / maxSerie) * 100);
            return (
              <div key={m.key} className="flex flex-col items-center gap-1 h-full">
                <div className="flex items-end gap-0.5 h-full w-full justify-center">
                  <div className="w-3 rounded-t bg-muted-foreground/30" style={{ height: `${rh}%` }} title={`Receita ${formatBRL(m.revenue)}`} />
                  <div className="w-3 rounded-t bg-emerald-500" style={{ height: `${ph}%` }} title={`Lucro ${formatBRL(m.profit)}`} />
                </div>
                <span className="text-[10px] text-muted-foreground capitalize">{m.label}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Kpi({ icon, label, value, hint, accent }: { icon: React.ReactNode; label: string; value: string; hint?: string; accent?: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}<span className="truncate">{label}</span>
      </div>
      <div className={cn("text-lg sm:text-xl font-semibold mt-1 leading-tight", accent)}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</div>}
    </Card>
  );
}
