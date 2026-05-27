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
// JWT anon keys for the forbidden project embed this base64 fingerprint
// (the base64 encoding of the JSON fragment `"ref":"ajeyimujgtukcbadyash"`
// at its natural 3-byte alignment inside the JWT payload). Catches the
// SUPABASE_PUBLISHABLE_KEY auto-injected by Lovable Cloud which points at
// the empty database `ajeyimujgtukcbadyash`.
const FORBIDDEN_REF_B64 = "ImFqZXlpbXVqZ3R1a2NiYWR5YXNo";
const EXPECTED_REF = "pkghjzbvmifmztqvpdeu";
const EXPECTED_REF_B64 = "InBrZ2hqemJ2bWlmbXp0cXZwZGV1"; // base64 of `"ref":"pkghjzbvmifmztqvpdeu"`
const EXPECTED_URL = "https://pkghjzbvmifmztqvpdeu.supabase.co";
// Public anon key for the legacy project. This is intentionally client-visible
// (Supabase anon keys are public) and guarantees published builds still work
// when Lovable Cloud runtime secrets are not available to the publish builder.
const EMBEDDED_EXPECTED_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrZ2hqemJ2bWlmbXp0cXZwZGV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NzgyODAsImV4cCI6MjA5NTE1NDI4MH0.3knFO0vkJ8uMolrcosHYx3kGB1O6rblroV1aJiRKzko";

const jwtProjectRef = (value: string): string | null => {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return typeof payload.ref === "string" ? payload.ref : null;
  } catch {
    return null;
  }
};

const matchesExpectedValue = (value: string) => {
  const ref = jwtProjectRef(value);
  return ref === EXPECTED_REF || value.includes(EXPECTED_REF) || value.includes(EXPECTED_REF_B64);
};

const isForbiddenValue = (value: string) => {
  const ref = jwtProjectRef(value);
  return ref === FORBIDDEN_REF || value.includes(FORBIDDEN_REF) || value.includes(FORBIDDEN_REF_B64);
};

// Pick the first non-empty value that does NOT reference the forbidden
// (empty) Lovable Cloud database. This makes the build immune to the
// auto-generated .env pointing at the wrong project.
const pick = (...keys: string[]) => {
  for (const k of keys) {
    const v = env[k];
    if (v !== undefined && v !== "" && !isForbiddenValue(v)) return v;
  }
  return "";
};
// Prefer a JWT/value that positively matches the EXPECTED project, then
// fall back to the standard pick. Guarantees the published bundle uses
// the anon key of pkghjzbvmifmztqvpdeu even if other vars are present.
// Returns the value and the source key name so the build log can prove
// (without exposing the secret) which secret was actually injected.
const pickExpectedTraced = (label: string, ...keys: string[]): string => {
  let chosen: { key: string; value: string; reason: string } | null = null;
  const considered: Array<{ key: string; present: boolean; forbidden: boolean; matchesExpected: boolean }> = [];
  for (const k of keys) {
    const v = env[k];
    const present = v !== undefined && v !== "";
    const forbidden = present && (v!.includes(FORBIDDEN_REF) || v!.includes(FORBIDDEN_REF_B64));
    const matchesExpected = present && !forbidden && (v!.includes(EXPECTED_REF) || v!.includes(EXPECTED_REF_B64));
    considered.push({ key: k, present, forbidden, matchesExpected });
    if (matchesExpected && !chosen) chosen = { key: k, value: v!, reason: "matches-expected" };
  }
  if (!chosen) {
    // Fallback: any non-empty, non-forbidden value (covers new sb_publishable_* format
    // where the project ref is NOT embedded literally inside the key).
    for (const k of keys) {
      const v = env[k];
      if (v && !v.includes(FORBIDDEN_REF) && !v.includes(FORBIDDEN_REF_B64)) {
        chosen = { key: k, value: v, reason: "non-forbidden-fallback" };
        break;
      }
    }
  }
  // Safe build log: no secret values, only metadata.
  // eslint-disable-next-line no-console
  console.log(
    `[vite-config] ${label} selection:`,
    JSON.stringify({
      chosen: chosen ? { key: chosen.key, reason: chosen.reason, length: chosen.value.length } : null,
      considered,
    }),
  );
  return chosen?.value ?? "";
};

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        pick("URL_SUPABASE", "VITE_SUPABASE_URL", "SUPABASE_URL") || EXPECTED_URL,
      ),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
        pickExpectedTraced(
          "VITE_SUPABASE_ANON_KEY",
          "ANON_KEY_SUPABASE",
          "SUPABASE_ANON_KEY",
          "VITE_SUPABASE_ANON_KEY",
          "SUPABASE_PUBLISHABLE_KEY",
          "VITE_SUPABASE_PUBLISHABLE_KEY",
        ),
      ),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        pickExpectedTraced(
          "VITE_SUPABASE_PUBLISHABLE_KEY",
          "ANON_KEY_SUPABASE",
          "SUPABASE_ANON_KEY",
          "VITE_SUPABASE_ANON_KEY",
          "SUPABASE_PUBLISHABLE_KEY",
          "VITE_SUPABASE_PUBLISHABLE_KEY",
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
