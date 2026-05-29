// DB-first sync para DNS (dns_domains + dns_routes) no boot global.
// Garante que outros dispositivos hidratam DNS sem depender da rota
// /admin-dns-rotas. Cache local vazio NÃO sobrescreve banco; banco vazio
// + cache local NÃO sobrescreve cache (hydrateDnsFromDb já é não-destrutivo).
import { useCallback } from "react";
import { useDbFirstSync } from "@/hooks/useDbFirstSync";
import { hydrateDnsFromDb } from "@/lib/dns-routes-db";
import { DNS_ROUTES_EVENT } from "@/lib/dns-routes";

export function useDnsRoutesSync() {
  const hydrate = useCallback(async (companyId: string) => {
    try {
      await hydrateDnsFromDb(companyId);
    } catch { /* noop — sync periódico retenta */ }
  }, []);

  // Sem mirror automático aqui: writes do DNS já vão direto ao banco via
  // upsertDnsDomainServer/upsertDnsRouteServer chamados pela tela admin.
  // Promoção de cache legado → banco continua manual (botão "Subir local
  // para o banco") em /admin-dns-rotas para evitar push destrutivo no boot.
  useDbFirstSync({
    table: "dns_routes",
    hydrate,
    mirrorEvents: [DNS_ROUTES_EVENT],
  });
}
