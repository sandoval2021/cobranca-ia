// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Map Lovable Cloud secrets (without VITE_ prefix) to VITE_* frontend env vars.
// Falls back to VITE_*-prefixed env if already provided that way.
// Rebuild trigger: inject secrets URL_SUPABASE / ANON_KEY_SUPABASE into published bundle.
const env = process.env;
const FORBIDDEN_REF = "ajeyimujgtukcbadyash";
const EXPECTED_URL = "https://pkghjzbvmifmztqvpdeu.supabase.co";
// Pick the first non-empty value that does NOT reference the forbidden
// (empty) Lovable Cloud database. This makes the build immune to the
// auto-generated .env pointing at the wrong project.
const pick = (...keys: string[]) => {
  for (const k of keys) {
    const v = env[k];
    if (v !== undefined && v !== "" && !v.includes(FORBIDDEN_REF)) return v;
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
        pick("URL_SUPABASE", "VITE_SUPABASE_URL", "SUPABASE_URL"),
      ),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
        pick(
          "ANON_KEY_SUPABASE",
          "SUPABASE_ANON_KEY",
          "VITE_SUPABASE_ANON_KEY",
          "SUPABASE_PUBLISHABLE_KEY",
          "VITE_SUPABASE_PUBLISHABLE_KEY",
        ),
      ),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        pick(
          "ANON_KEY_SUPABASE",
          "SUPABASE_PUBLISHABLE_KEY",
          "VITE_SUPABASE_PUBLISHABLE_KEY",
          "SUPABASE_ANON_KEY",
          "VITE_SUPABASE_ANON_KEY",
        ),
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
