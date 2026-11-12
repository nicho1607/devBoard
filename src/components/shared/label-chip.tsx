import { cn } from "@/lib/utils";
import type { LabelDTO } from "@/types/board";

/** Chip con el color de la etiqueta como tinte (legible sobre fondo oscuro). */
export function LabelChip({ label, className }: { label: LabelDTO; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-none",
        className,
      )}
      style={{ color: label.color, backgroundColor: `${label.color}1f` }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: label.color }} />
      {label.name}
    </span>
  );
}
