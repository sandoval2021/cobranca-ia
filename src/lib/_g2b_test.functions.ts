// TEMP — G2B validation only. Delete after use.
import { createServerFn } from "@tanstack/react-start";

export const g2bCallRenewalHook = createServerFn({ method: "POST" }).handler(
  async () => {
    const secret = process.env.CRON_HOOK_SECRET || "";
    const base =
      process.env.PUBLIC_APP_URL ||
      "https://project--d41959a8-9c27-4d26-8c78-a6dc4f4a0793-dev.lovable.app";
    const url = `${base.replace(/\/$/, "")}/api/public/hooks/renewal-dispatch`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "x-cobraeasy-cron-secret": secret },
    });
    const body = await res.text();
    return {
      status: res.status,
      body: body.slice(0, 500),
      secret_present: secret.length > 0,
    };
  },
);
