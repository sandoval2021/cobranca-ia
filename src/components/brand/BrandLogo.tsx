import logoFull from "@/assets/cobraeasy-logo.png";
import logoMark from "@/assets/cobraeasy-mark.png";
import { cn } from "@/lib/utils";

type Props = {
  variant?: "full" | "mark";
  className?: string;
  alt?: string;
};

export function BrandLogo({ variant = "mark", className, alt = "CobraEasy" }: Props) {
  const src = variant === "full" ? logoFull : logoMark;
  return (
    <img
      src={src}
      alt={alt}
      className={cn("select-none object-contain", className)}
      draggable={false}
      decoding="async"
    />
  );
}
