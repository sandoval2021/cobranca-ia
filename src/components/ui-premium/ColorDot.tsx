export function ColorDot({ color, label }: { color: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className="h-2.5 w-2.5 rounded-full ring-2 ring-background"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {label && <span className="truncate">{label}</span>}
    </span>
  );
}
