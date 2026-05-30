// Worker seguro para renewal_tasks.
//
// Política atual: NÃO existe integração real e segura para renovar
// automaticamente em painéis/servidores IPTV de terceiros. Portanto este
// worker NUNCA marca uma task como `renewed` por conta própria — ele apenas:
//
//   1. faz claim atômico das tasks elegíveis (status=pending, dentro do
//      next_attempt_at, attempts<max_attempts) via RPC
//      claim_renewal_tasks_batch, que usa FOR UPDATE SKIP LOCKED;
//   2. encaminha cada task claimed para `needs_human` com um motivo curto,
//      sanitizado e sem dados sensíveis;
//   3. limpa o lock para não bloquear a fila;
//   4. NÃO altera vencimento/saldo do cliente, NÃO marca `renewed`,
//      NÃO confirma renovação sem ação humana.
//
// Quando integração real for adicionada (Fase G3+), a etapa 2 passa a chamar
// o adapter correspondente e, somente com confirmação positiva do provedor,
// muda o status para `renewed`. Em caso de timeout/resultado incerto a task
// continua indo para `needs_human` em vez de `renewed`, para nunca duplicar.
//
// Protegido por header `x-cobraeasy-cron-secret` (timing-safe). Sem secret
// configurado no servidor, o endpoint retorna 401 e não executa nada.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { pickProviderForServer } from "@/lib/iptv/providers/sigma.server";

const WORKER_NAME = "renewal-worker";
const COMPANIES_PER_RUN = 50;
const TASKS_PER_COMPANY = 20;

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function checkAuth(request: Request): boolean {
  const provided = request.headers.get("x-cobraeasy-cron-secret") || "";
  const expected = process.env.CRON_HOOK_SECRET || "";
  if (!expected) return false;
  return Boolean(provided) && timingSafeEq(provided, expected);
}

function sanitize(raw: unknown): string {
  if (raw == null) return "";
  let s = String(raw).slice(0, 240);
  s = s.replace(/[A-Za-z0-9_-]{32,}/g, "[oculto]");
  s = s.replace(/https?:\/\/\S+/g, "[link]");
  return s;
}

type ClaimedTask = {
  id: string;
  company_id: string;
  customer_id: string;
  server_id: string | null;
  credential_id: string | null;
  kind: string;
  attempts: number;
  max_attempts: number;
  plan_days: number | null;
};

async function listCompaniesWithPending(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("renewal_tasks")
    .select("company_id")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .limit(500);
  if (error || !data) return [];
  const seen = new Set<string>();
  for (const row of data as Array<{ company_id: string }>) {
    if (row.company_id) seen.add(row.company_id);
    if (seen.size >= COMPANIES_PER_RUN) break;
  }
  return [...seen];
}

async function claimForCompany(companyId: string): Promise<ClaimedTask[]> {
  const { data, error } = await supabaseAdmin.rpc(
    "claim_renewal_tasks_batch" as any,
    {
      p_company_id: companyId,
      p_limit: TASKS_PER_COMPANY,
      p_worker: WORKER_NAME,
    },
  );
  if (error || !data) return [];
  return data as ClaimedTask[];
}

async function markNeedsHuman(
  task: ClaimedTask,
  reason: string,
): Promise<void> {
  // Guard contra corrida: só atualiza se ainda estiver em 'trying'.
  // Não altera customers/financeiro — apenas a task.
  await supabaseAdmin
    .from("renewal_tasks")
    .update({
      status: "needs_human",
      locked_at: null,
      locked_by: null,
      last_error: sanitize(reason),
      updated_at: new Date().toISOString(),
    })
    .eq("id", task.id)
    .eq("company_id", task.company_id)
    .eq("status", "trying");
}

export const Route = createFileRoute("/api/public/hooks/renewal-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!checkAuth(request)) {
          return new Response("unauthorized", { status: 401 });
        }

        let companiesProcessed = 0;
        let tasksClaimed = 0;
        let needsHuman = 0;
        const renewed = 0;
        const retried = 0;
        const failed = 0;

        try {
          const companies = await listCompaniesWithPending();
          for (const companyId of companies) {
            const tasks = await claimForCompany(companyId);
            if (tasks.length === 0) continue;
            companiesProcessed += 1;
            tasksClaimed += tasks.length;

            for (const task of tasks) {
              // Provider fail-safe: por enquanto sempre cai em manual.
              // Quando um adapter real existir, attemptRenewal pode retornar
              // { kind: "renewed" } e marcamos a task como renewed; até lá,
              // qualquer resultado vira needs_human (sem alterar cliente).
              let panelType: string | null = null;
              if (task.server_id) {
                const { data: srv } = await supabaseAdmin
                  .from("servers")
                  .select("panel_type")
                  .eq("id", task.server_id)
                  .eq("company_id", task.company_id)
                  .maybeSingle();
                panelType = (srv?.panel_type as string | null) ?? null;
              }
              const provider = pickProviderForServer(panelType);
              const result = await provider.attemptRenewal({ task });
              if (result.kind === "renewed") {
                // Reservado para integração futura — não usado nesta fase.
                await markNeedsHuman(
                  task,
                  "Resultado automático ignorado nesta fase — confirme manualmente.",
                );
                needsHuman += 1;
              } else {
                await markNeedsHuman(task, result.reason);
                needsHuman += 1;
              }
            }
          }
        } catch {
          // Não vazamos detalhe técnico.
        }

        return Response.json({
          ok: true,
          companies_processed: companiesProcessed,
          tasks_claimed: tasksClaimed,
          renewed,
          needs_human: needsHuman,
          retried,
          failed,
        });
      },
    },
  },
});
