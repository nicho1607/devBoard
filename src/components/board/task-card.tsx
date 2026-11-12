import { CheckSquare, MessageSquare } from "lucide-react";
import { AvatarStack } from "@/components/shared/user-avatar";
import { LabelChip } from "@/components/shared/label-chip";
import { PRIORITY_META } from "@/lib/priority";
import { cn } from "@/lib/utils";
import type { BoardTask } from "@/types/board";

type Props = { task: BoardTask; isDragging?: boolean };

/** Tarjeta presentacional; la lógica de drag vive en BoardColumn. */
export function TaskCard({ task, isDragging }: Props) {
  const priority = PRIORITY_META[task.priority];
  const PriorityIcon = priority.icon;
  const allDone = task.subtaskTotal > 0 && task.subtaskDone === task.subtaskTotal;

  return (
    <article
      className={cn(
        "group rounded-md border border-l-2 bg-card p-3 text-left shadow-sm transition",
        "hover:border-foreground/20 hover:bg-accent/40",
        priority.border,
        isDragging && "rotate-1 border-primary/50 shadow-xl shadow-black/40",
      )}
    >
      <header className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-muted-foreground">{task.key}</span>
        <span className={cn("flex items-center gap-1 text-[11px]", priority.text)} title={`Prioridad ${priority.label}`}>
          <PriorityIcon className="size-3.5" aria-hidden />
          <span className="sr-only sm:not-sr-only">{priority.label}</span>
        </span>
      </header>

      <h3 className="line-clamp-3 text-sm font-medium leading-snug">{task.title}</h3>

      {task.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.map((l) => (
            <LabelChip key={l.id} label={l} />
          ))}
        </div>
      )}

      <footer className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {task.estimate !== null && (
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono" title="Estimación">
              {task.estimate}
              {task.estimateUnit === "POINTS" ? "pt" : "h"}
            </span>
          )}
          {task.subtaskTotal > 0 && (
            <span className={cn("flex items-center gap-1", allDone && "text-emerald-400")}>
              <CheckSquare className="size-3.5" aria-hidden />
              {task.subtaskDone}/{task.subtaskTotal}
            </span>
          )}
          {task.commentCount > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="size-3.5" aria-hidden />
              {task.commentCount}
            </span>
          )}
        </div>
        <AvatarStack users={task.assignees} />
      </footer>
    </article>
  );
}
