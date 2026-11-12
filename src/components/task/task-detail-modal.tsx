"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTaskModal } from "@/hooks/use-task-modal";
import { api, ApiError } from "@/lib/api-client";
import { useBoardStore } from "@/stores/board-store";
import type { TaskDetail, TaskMutationResponse } from "@/types/board";
import { ActivityFeed } from "./activity-feed";
import { CommentThread } from "./comment-thread";
import { DescriptionEditor } from "./description-editor";
import { SubtaskChecklist } from "./subtask-checklist";
import { TaskProperties } from "./task-properties";
import { TaskTitle } from "./task-title";

export type Mutate = (url: string, method: string, body?: unknown) => Promise<boolean>;

export function TaskDetailModal() {
  const { openTaskId, close } = useTaskModal();
  const upsertTask = useBoardStore((s) => s.upsertTask);
  const removeTask = useBoardStore((s) => s.removeTask);
  // Versión del tablero de la tarea abierta: cambia cuando llega un evento realtime.
  const boardUpdatedAt = useBoardStore((s) => (openTaskId ? s.tasks[openTaskId]?.updatedAt : undefined));
  const [detail, setDetail] = useState<TaskDetail | null>(null);

  const load = useCallback(
    async (taskId: string) => {
      try {
        const res = await api<TaskMutationResponse>(`/api/tasks/${taskId}`);
        setDetail(res.detail);
      } catch (err) {
        toast.error(err instanceof ApiError && err.status === 404 ? "La tarea no existe" : "Error al cargar");
        close();
      }
    },
    [close],
  );

  useEffect(() => {
    setDetail(null);
    if (openTaskId) void load(openTaskId);
  }, [openTaskId, load]);

  // Otro usuario editó la tarea → recargar el detalle (comentarios, subtareas, historial).
  useEffect(() => {
    if (openTaskId && detail && boardUpdatedAt && boardUpdatedAt > detail.updatedAt) {
      void load(openTaskId);
    }
  }, [boardUpdatedAt, detail, openTaskId, load]);

  // Si alguien elimina la tarea mientras está abierta.
  const existsOnBoard = useBoardStore((s) => (openTaskId ? openTaskId in s.tasks : true));
  useEffect(() => {
    if (detail && !existsOnBoard) {
      toast.info("Esta tarea fue eliminada");
      close();
    }
  }, [existsOnBoard, detail, close]);

  /** Ejecuta una mutación y sincroniza detalle + tablero con la respuesta. */
  const mutate: Mutate = useCallback(
    async (url, method, body) => {
      try {
        const res = await api<TaskMutationResponse | undefined>(url, { method, body });
        if (res) {
          setDetail(res.detail);
          upsertTask(res.task);
        }
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar");
        return false;
      }
    },
    [upsertTask],
  );

  const onDelete = useCallback(async () => {
    if (!detail || !confirm(`¿Eliminar ${detail.key}? Esta acción no se puede deshacer.`)) return;
    if (await mutate(`/api/tasks/${detail.id}`, "DELETE")) {
      setDetail(null); // antes de removeTask, para no disparar el aviso de "eliminada por otro"
      removeTask(detail.id);
      close();
    }
  }, [detail, mutate, removeTask, close]);

  return (
    <Dialog open={Boolean(openTaskId)} onOpenChange={(o) => !o && close()}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        {!detail ? (
          <ModalSkeleton />
        ) : (
          <>
            <header className="border-b px-5 pt-4 pb-3 pr-12">
              <DialogDescription className="font-mono text-xs">{detail.key}</DialogDescription>
              <DialogTitle asChild>
                <TaskTitle
                  title={detail.title}
                  onSave={(title) => mutate(`/api/tasks/${detail.id}`, "PATCH", { title })}
                />
              </DialogTitle>
            </header>

            <div className="grid flex-1 overflow-y-auto md:grid-cols-[1fr_260px] md:overflow-hidden">
              <div className="space-y-6 p-5 md:overflow-y-auto">
                <DescriptionEditor
                  value={detail.description ?? ""}
                  onSave={(description) =>
                    mutate(`/api/tasks/${detail.id}`, "PATCH", { description: description || null })
                  }
                />
                <SubtaskChecklist taskId={detail.id} subtasks={detail.subtasks} mutate={mutate} />

                <Tabs defaultValue="comments">
                  <TabsList>
                    <TabsTrigger value="comments">Comentarios ({detail.comments.length})</TabsTrigger>
                    <TabsTrigger value="activity">Historial</TabsTrigger>
                  </TabsList>
                  <TabsContent value="comments" className="pt-3">
                    <CommentThread taskId={detail.id} comments={detail.comments} mutate={mutate} />
                  </TabsContent>
                  <TabsContent value="activity" className="pt-3">
                    <ActivityFeed activities={detail.activities} />
                  </TabsContent>
                </Tabs>
              </div>

              <aside className="border-t bg-muted/20 p-5 md:overflow-y-auto md:border-t-0 md:border-l">
                <TaskProperties task={detail} mutate={mutate} onDelete={onDelete} />
              </aside>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ModalSkeleton() {
  return (
    <div className="space-y-4 p-5">
      <DialogTitle className="sr-only">Cargando tarea</DialogTitle>
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}
