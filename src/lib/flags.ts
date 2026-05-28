function readBool(v: string | undefined, fallback: boolean) {
  if (v === undefined) return fallback;
  return v === "true" || v === "1";
}

export const flags = {
  appEnv: "production",
  stagingMode: false,
  allowRealPayments: true,
  allowRealWhatsapp: true,
  allowRealAi: true,
};

export const STAGING_BLOCK_MESSAGE =
  "Esta ação está temporariamente indisponível.";
