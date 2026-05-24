function readBool(v: string | undefined, fallback: boolean) {
  if (v === undefined) return fallback;
  return v === "true" || v === "1";
}

export const flags = {
  appEnv: (import.meta.env.VITE_APP_ENV as string | undefined) ?? "staging",
  stagingMode: readBool(import.meta.env.VITE_STAGING_MODE as string | undefined, true),
  allowRealPayments: readBool(
    import.meta.env.VITE_ALLOW_REAL_PAYMENTS as string | undefined,
    false,
  ),
  allowRealWhatsapp: readBool(
    import.meta.env.VITE_ALLOW_REAL_WHATSAPP as string | undefined,
    false,
  ),
  allowRealAi: readBool(
    import.meta.env.VITE_ALLOW_REAL_AI as string | undefined,
    false,
  ),
};

export const STAGING_BLOCK_MESSAGE =
  "Ambiente de testes: esta ação real está bloqueada.";
