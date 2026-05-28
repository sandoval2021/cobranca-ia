// Aviso de escopo por empresa — mostra a empresa ativa, ou visão Global/Admin.
// Apenas leitura. Não altera nada.

import { useEffect, useState } from "react";
import { Building2, Globe2, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import { getCurrentRole } from "@/lib/local-auth";
import { getActiveCompany } from "@/lib/company-scope";
import { getMigrationPreview } from "@/lib/company-scope";

type Props = {
  /** Chave de storage do módulo (ex: "cobranca_ia_finance_entries_v1"). Se passar, mostra aviso de dados sem company_id apenas para esse módulo. */
  moduleKey?: string;
  className?: string;
};

export function CompanyScopeNotice({ moduleKey, className }: Props) {
  const [, force] = useState(0);
  useEffect(() => {
    const onChange = () => force((n) => n + 1);
    window.addEventListener("storage", onChange);
    window.addEventListener("cobranca_ia_companies:changed", onChange as EventListener);
    window.addEventListener("cobranca-local-auth-changed", onChange as EventListener);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("cobranca_ia_companies:changed", onChange as EventListener);
      window.removeEventListener("cobranca-local-auth-changed", onChange as EventListener);
    };
  }, []);

  const role = getCurrentRole();
  const company = getActiveCompany();

  let unscoped = 0;
  if (moduleKey) {
    const preview = getMigrationPreview().find((p) => p.key === moduleKey);
    unscoped = preview?.sem_empresa ?? 0;
  }

  const isAdminGlobal = role === "super_admin" && !company;

  return (
    <Card className={`p-2.5 mb-3 border-dashed bg-muted/30 flex items-start gap-2 ${className ?? ""}`}>
      {isAdminGlobal ? (
        <Globe2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      ) : (
        <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      )}
      <div className="text-xs leading-snug space-y-0.5">
        {isAdminGlobal && (
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Visão Global/Admin</span> — dados de todas as empresas e
            registros sem empresa podem aparecer.
          </p>
        )}
        {role === "super_admin" && company && (
          <p className="text-muted-foreground">
            Visualizando empresa: <span className="font-medium text-foreground">{company.nome}</span>
          </p>
        )}
        {role === "owner" && company && (
          <p className="text-muted-foreground">
            Empresa: <span className="font-medium text-foreground">{company.nome}</span>
          </p>
        )}
        {role === "owner" && !company && (
          <p className="text-muted-foreground">
            Sua conta ainda não está vinculada a uma empresa.
          </p>
        )}
        {unscoped > 0 && role === "super_admin" && (
          <p className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {unscoped} registro(s) sem empresa neste módulo.{" "}
            <Link to="/migracao-empresa" className="underline">
              Migração Empresa
            </Link>
          </p>
        )}
      </div>
    </Card>
  );
}
