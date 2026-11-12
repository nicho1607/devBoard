"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { useBoardRealtime } from "@/hooks/use-board-realtime";
import { useTaskModal } from "@/hooks/use-task-modal";
import { api, ApiError } from "@/lib/api-client";
import { matchesFilters, parseFilters } from "@/lib/filters";
import { comparePosition, positionBetween } from "@/lib/ordering";
import { useBoardStore, useBoardStoreApi } from "@/stores/board-store";
import type { BoardTask } from "@/types/board";
import type { BoardEvent } from "@/lib/realtime/events";
import { BoardColumn } from "./board-column";

type MoveResponse = Omit<Extract<BoardEvent, { type: "task:moved" }>, "type">;

/**
 * Tablero Kanban con drag & drop optimista:
 *   1. Al soltar, calcula la nueva posición localmente y actualiza el store
 *      al instante (UI sin latencia).
 *   2. Envía al servidor los vecinos visibles (prev/next).
 *   3. Aplica la respuesta autoritativa del servidor; si falla, revierte.
 *      En 409 (conflicto con otro usuario) resincroniza todo el tablero.
 * El resto del equipo recibe el cambio vía Pusher (useBoardRealtime).
 */
export function KanbanBoard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeApi = useBoardStoreApi();
  const projectId = useBoardStore((s) => s.projectId);
  const columns = useBoardStore((s) => s.columns);
  const tasks = useBoardStore((s) => s.tasks);
  const { open } = useTaskModal();

  useBoardRealtime(projectId);

  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  // Agrupa por columna, ordena por posición y aplica filtros en una pasada.
  const { visible, totals } = useMemo(() => {
    const visible: Record<string, BoardTask[]> = {};
    const totals: Record<string, number> = {};
    for (const col of columns) {
      visible[col.id] = [];
      totals[col.id] = 0;
    }
    for (const task of Object.values(tasks)) {
      if (!(task.columnId in visible)) continue;
      totals[task.columnId]++;
      if (matchesFilters(task, filters)) visible[task.columnId].push(task);
    }
    for (const list of Object.values(visible)) list.sort(comparePosition);
    return { visible, totals };
  }, [columns, tasks, filters]);

  const onDragEnd = useCallback(
    async ({ draggableId, source, destination }: DropResult) => {
      if (!destination) return;
      if (destination.droppableId === source.droppableId && destination.index === source.index) return;

      // Vecinos en la lista destino SIN la tarea arrastrada (dnd ya da el índice final).
      const destList = visible[destination.droppableId].filter((t) => t.id !== draggableId);
      const prev = destList[destination.index - 1] ?? null;
      const next = destList[destination.index] ?? null;

      const { moveTask, upsertTask, applyPositions, tasks: current } = storeApi.getState();
      const snapshot = current[draggableId];
      if (!snapshot) return;

      moveTask(
        draggableId,
        destination.droppableId,
        positionBetween(prev?.position ?? null, next?.position ?? null),
      );

      try {
        const res = await api<MoveResponse>(`/api/tasks/${draggableId}/move`, {
          method: "PATCH",
          body: {
            columnId: destination.droppableId,
            prevTaskId: prev?.id ?? null,
            nextTaskId: next?.id ?? null,
          },
        });
        if (res.rebalanced) applyPositions(res.rebalanced);
        upsertTask(res.task);
      } catch (err) {
        upsertTask(snapshot);
        if (err instanceof ApiError && err.status === 409) {
          toast.info("Otro miembro modificó el tablero. Sincronizando…");
          router.refresh();
        } else {
          toast.error(err instanceof Error ? err.message : "No se pudo mover la tarea");
        }
      }
    },
    [visible, storeApi, router],
  );

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex h-full snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:snap-none md:px-6">
        {columns.map((column) => (
          <BoardColumn
            key={column.id}
            column={column}
            tasks={visible[column.id]}
            totalCount={totals[column.id]}
            onOpenTask={open}
          />
        ))}
      </div>
    </DragDropContext>
  );
}
