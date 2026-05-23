import { cn } from "@/lib/utils";

export type Status = "ativo" | "atrasado" | "vencendo" | "pago" | "pendente" | "falhou" | "novo";

const map: Record<Status, { label: string; cls: string }> = {
  ativo: { label: "Ativo", cls: "bg-success-soft text-success" },
  atrasado: { label: "Atrasado", cls: "bg-danger-soft text-danger" },
  vencendo: { label: "Vence em breve", cls: "bg-warning-soft text-warning" },
  pago: { label: "Pago", cls: "bg-success-soft text-success" },
  pendente: { label: "Pendente", cls: "bg-warning-soft text-warning" },
  falhou: { label: "Falhou", cls: "bg-danger-soft text-danger" },
  novo: { label: "Novo", cls: "bg-info-soft text-info" },
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const s = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        s.cls,
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {s.label}
    </span>
  );
}
