// Fire-and-forget mirror para banco. Não bloqueia UI.
// Se falhar, o cache local permanece e o sync hook re-tenta no próximo ciclo.
import { getCurrentCompanyId } from "@/lib/companies";

function isUuid(s: string | undefined | null): s is string {
  return !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export function mirror(fn: (companyId: string) => Promise<unknown>) {
  if (typeof window === "undefined") return;
  const companyId = getCurrentCompanyId();
  if (!isUuid(companyId)) return; // sem empresa real, fica só local; sync hook resolve depois
  // microtask: não bloqueia render
  queueMicrotask(() => {
    fn(companyId).catch(() => {
      /* silencioso: hook re-sincroniza */
    });
  });
}

export { isUuid };
