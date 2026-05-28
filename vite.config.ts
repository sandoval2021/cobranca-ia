// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Map Lovable Cloud secrets to VITE_* frontend env vars.
// Browser auth and server-function auth MUST use the same backend project;
// otherwise the server rejects browser JWTs as "Unauthorized: Invalid token".
const env = process.env;

const pick = (...keys: string[]) => {
  for (const k of keys) {
    const v = env[k];
    if (v !== undefined && v !== "") return v;
  }
  return "";
};

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        pick("VITE_SUPABASE_URL", "SUPABASE_URL"),
      ),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
        pick("VITE_SUPABASE_ANON_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"),
      ),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        pick("VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"),
      ),

      "import.meta.env.VITE_APP_ENV": JSON.stringify(
        pick("APP_ENV", "VITE_APP_ENV") || "staging",
      ),
      "import.meta.env.VITE_STAGING_MODE": JSON.stringify(
        pick("STAGING_MODE", "VITE_STAGING_MODE") || "true",
      ),
      "import.meta.env.VITE_ALLOW_REAL_PAYMENTS": JSON.stringify(
        pick("ALLOW_REAL_PAYMENTS", "VITE_ALLOW_REAL_PAYMENTS") || "false",
      ),
      "import.meta.env.VITE_ALLOW_REAL_WHATSAPP": JSON.stringify(
        pick("ALLOW_REAL_WHATSAPP", "VITE_ALLOW_REAL_WHATSAPP") || "false",
      ),
      "import.meta.env.VITE_ALLOW_REAL_AI": JSON.stringify(
        pick("ALLOW_REAL_AI", "VITE_ALLOW_REAL_AI") || "false",
      ),
    },
  },
});
