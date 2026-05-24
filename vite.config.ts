// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(process.env.URL_SUPABASE ?? ""),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(process.env.SUPABASE_ANON_KEY ?? ""),
      "import.meta.env.VITE_APP_ENV": JSON.stringify(process.env.APP_ENV ?? "staging"),
      "import.meta.env.VITE_STAGING_MODE": JSON.stringify(process.env.STAGING_MODE ?? "true"),
      "import.meta.env.VITE_ALLOW_REAL_PAYMENTS": JSON.stringify(process.env.ALLOW_REAL_PAYMENTS ?? "false"),
      "import.meta.env.VITE_ALLOW_REAL_WHATSAPP": JSON.stringify(process.env.ALLOW_REAL_WHATSAPP ?? "false"),
      "import.meta.env.VITE_ALLOW_REAL_AI": JSON.stringify(process.env.ALLOW_REAL_AI ?? "false"),
    },
  },
});
