// Provider Sigma — FAIL-SAFE.
//
// Nesta fase NÃO existe integração automática real e segura com o painel
// Sigma. Este provider existe somente para padronizar o ponto de extensão
// futuro. Regras invioláveis nesta fase:
//
//   - sem chamadas a API Sigma;
//   - sem scraping de HTML;
//   - sem login automático;
//   - sem navegador headless;
//   - sem clique simulado;
//   - sem leitura/escrita de senha em texto puro;
//   - attemptRenewal SEMPRE retorna manual_required.
//
// Quando uma integração oficial existir, ela deverá:
//   1. confirmar o resultado direto do provedor;
//   2. só então retornar { kind: "renewed", provider_ref };
//   3. em qualquer timeout/incerteza, continuar retornando manual_required.

import type {
  IptvProvider,
  ProviderAttemptResult,
  ProviderConfigStatus,
  ProviderContext,
} from "./provider";

export const sigmaProvider: IptvProvider = {
  id: "sigma",

  canAttemptAutoRenew(): boolean {
    return false;
  },

  async validateConfig(): Promise<ProviderConfigStatus> {
    return { ok: false, reason: "auto_not_configured" };
  },

  async dryRun(_ctx: ProviderContext): Promise<ProviderAttemptResult> {
    return {
      kind: "manual_required",
      reason:
        "Sigma: renovação automática indisponível. Renove no painel e confirme aqui.",
    };
  },

  async attemptRenewal(_ctx: ProviderContext): Promise<ProviderAttemptResult> {
    // Fail-safe: nunca renova sozinho nesta fase.
    return {
      kind: "manual_required",
      reason:
        "Sigma: renovação automática indisponível. Renove no painel e confirme aqui.",
    };
  },
};

export function pickProviderForServer(
  panelType: string | null | undefined,
): IptvProvider {
  // Hoje só temos o adapter Sigma fail-safe. Outros painéis usam o mesmo
  // fluxo manual assistido por enquanto.
  if (panelType && panelType.toLowerCase().includes("sigma")) return sigmaProvider;
  return sigmaProvider;
}
