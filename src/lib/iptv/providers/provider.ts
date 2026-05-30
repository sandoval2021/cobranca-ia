// Interface comum para providers IPTV. Server-only.
// Nesta fase NENHUM provider executa renovação automática real.
// Toda integração nova deve preservar o contrato: se não houver confirmação
// 100% segura do painel/servidor, NUNCA retornar { ok: true, renewed: true }.

export type ProviderId = "sigma" | "outros";

export type ProviderConfigStatus =
  | { ok: true }
  | { ok: false; reason: "auto_not_configured" | "missing_api" | "unsupported" };

export type ProviderAttemptResult =
  | { kind: "manual_required"; reason: string }
  | { kind: "renewed"; provider_ref?: string | null };

export type ProviderContext = {
  task: {
    id: string;
    company_id: string;
    customer_id: string;
    server_id: string | null;
    credential_id: string | null;
    plan_days: number | null;
  };
};

export interface IptvProvider {
  readonly id: ProviderId;
  readonly canAttemptAutoRenew: () => boolean;
  readonly validateConfig: () => Promise<ProviderConfigStatus>;
  readonly dryRun: (ctx: ProviderContext) => Promise<ProviderAttemptResult>;
  readonly attemptRenewal: (ctx: ProviderContext) => Promise<ProviderAttemptResult>;
}
