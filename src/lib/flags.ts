function readBool(v: string | undefined, fallback: boolean) {
  if (v === undefined) return fallback;
  return v === "true" || v === "1";
}

export const flags = {
  appEnv: (import.meta.env.VITE_APP_ENV as string | undefined) ?? "production",
  stagingMode: readBool(import.meta.env.VITE_STAGING_MODE as string | undefined, false),
  allowRealPayments: readBool(
    import.meta.env.VITE_ALLOW_REAL_PAYMENTS as string | undefined,
    true,
  ),
  allowRealWhatsapp: readBool(
    import.meta.env.VITE_ALLOW_REAL_WHATSAPP as string | undefined,
    true,
  ),
  allowRealAi: readBool(
    import.meta.env.VITE_ALLOW_REAL_AI as string | undefined,
    true,
  ),
};

export const STAGING_BLOCK_MESSAGE =
  "Esta ação está temporariamente indisponível.";
