"use client";

import { memo } from "react";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";
import type { BoardColumn as Column, BoardTask } from "@/types/board";
import { QuickAddTask } from "./quick-add-task";
import { TaskCard } from "./task-card";

const KIND_DOT: Record<Column["kind"], string> = {
  BACKLOG: "bg-zinc-500",
  TODO: "bg-sky-500",
  IN_PROGRESS: "bg-amber-500",
  REVIEW: "bg-violet-500",
  DONE: "bg-emerald-500",
};

type Props = {
  column: Column;
  tasks: BoardTask[];
  /** Total real (sin filtros), para el contador y el límite WIP. */
  totalCount: number;
  onOpenTask: (taskId: string) => void;
};

export const BoardColumn = memo(function BoardColumn({ column, tasks, totalCount, onOpenTask }: Props) {
  const overWip = column.wipLimit !== null && totalCount > column.wipLimit;

  return (
    <section
      aria-label={column.name}
      className="flex max-h-full w-[85vw] shrink-0 snap-center flex-col rounded-lg bg-muted/40 sm:w-72"
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className={cn("size-2 rounded-full", KIND_DOT[column.kind])} />
        <h2 className="text-sm font-semibold">{column.name}</h2>
        <span
          className={cn(
            "ml-auto rounded px-1.5 font-mono text-xs text-muted-foreground",
            overWip && "bg-red-500/15 text-red-400",
          )}
          title={column.wipLimit ? `Límite WIP: ${column.wipLimit}` : undefined}
        >
          {tasks.length !== totalCount ? `${tasks.length}/${totalCount}` : totalCount}
          {column.wipLimit !== null && ` · ${column.wipLimit}`}
        </span>
      </header>

      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 transition-colors",
              snapshot.isDraggingOver && "bg-primary/5",
            )}
          >
            {tasks.map((task, index) => (
              <Draggable key={task.id} draggableId={task.id} index={index}>
                {(drag, dragSnapshot) => (
                  <div
                    ref={drag.innerRef}
                    {...drag.draggableProps}
                    {...drag.dragHandleProps}
                    role="button"
                    aria-label={`${task.key}: ${task.title}`}
                    onClick={() => onOpenTask(task.id)}
                    onKeyDown={(e) => {
                      // Espacio lo usa el teclado de dnd para "levantar" la tarjeta.
                      if (e.key === "Enter") onOpenTask(task.id);
                    }}
                    className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <TaskCard task={task} isDragging={dragSnapshot.isDragging} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <div className="px-2 pb-2">
        <QuickAddTask columnId={column.id} />
      </div>
    </section>
  );
});
