import { AlertTriangle, ArrowDown, ArrowUp, Minus, type LucideIcon } from "lucide-react";
import type { Priority } from "@prisma/client";

export const PRIORITIES: Priority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

export const PRIORITY_META: Record<
  Priority,
  { label: string; icon: LucideIcon; text: string; border: string; bg: string }
> = {
  URGENT: {
    label: "Urgente",
    icon: AlertTriangle,
    text: "text-red-400",
    border: "border-l-red-500",
    bg: "bg-red-500/15",
  },
  HIGH: {
    label: "Alta",
    icon: ArrowUp,
    text: "text-orange-400",
    border: "border-l-orange-500",
    bg: "bg-orange-500/15",
  },
  MEDIUM: {
    label: "Media",
    icon: Minus,
    text: "text-yellow-400",
    border: "border-l-yellow-500/70",
    bg: "bg-yellow-500/15",
  },
  LOW: {
    label: "Baja",
    icon: ArrowDown,
    text: "text-sky-400",
    border: "border-l-sky-500/60",
    bg: "bg-sky-500/15",
  },
};
