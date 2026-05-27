import { Link } from "@tanstack/react-router";
import { Sparkles, AlertTriangle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  daysUntilDue,
  getCompanyStatus,
  type Company,
} from "@/lib/companies";
import { getRevendaSettings } from "@/lib/revenda-settings";

export function AccountStatusBanner({ company }: { company: Company | null }) {
  if (!company) return null;
  const status = getCompanyStatus(company);
  const dias = daysUntilDue(company);

  if (status !== "teste" && status !== "vencida" && status !== "suspensa" && status !== "cancelada") {
    return null;
  }

  const support = getRevendaSettings().dados.whatsapp_suporte?.replace(/\D/g, "");
  const supportHref = support ? `https://wa.me/${support}` : null;

  let cfg: {
    Icon: typeof Sparkles;
    tone: string;
    title: string;
    desc: string;
  };

  if (status === "teste") {
    const restantes = Math.max(0, dias ?? 0);
    cfg = {
      Icon: Sparkles,
      tone: "border-sky-300/70 bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-100",
      title:
        restantes > 0
          ? `Seu teste grátis termina em ${restantes} ${restantes === 1 ? "dia" : "dias"}.`
          : "Seu teste grátis termina hoje.",
      desc: "Aproveite para cadastrar clientes e conhecer o sistema. Quando o teste acabar, fale com o suporte para continuar usando.",
    };
  } else if (status === "vencida") {
    cfg = {
      Icon: AlertTriangle,
      tone: "border-amber-300/70 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
      title: "Sua conta está vencida.",
      desc: "Você ainda pode entrar, ver seus clientes e exportar seus dados. Para voltar a cadastrar e cobrar normalmente, renove sua conta.",
    };
  } else {
    cfg = {
      Icon: ShieldAlert,
      tone: "border-rose-300/70 bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100",
      title:
        status === "cancelada" ? "Sua conta está cancelada." : "Sua conta está suspensa.",
      desc: "Por enquanto a maioria das ações está bloqueada. Seus dados estão seguros — fale com o suporte para reativar quando quiser.",
    };
  }

  const { Icon } = cfg;

  return (
    <div className={cn("border-b px-3 py-2 text-xs sm:text-sm", cfg.tone)}>
      <div className="mx-auto flex max-w-3xl items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{cfg.title}</p>
          <p className="mt-0.5 leading-snug opacity-90">{cfg.desc}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Link to="/meus-dados">
              <Button size="sm" variant="outline" className="h-7 text-xs">
                Ver minha conta
              </Button>
            </Link>
            {supportHref && (
              <a href={supportHref} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  Falar com suporte
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
