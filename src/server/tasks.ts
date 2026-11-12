import "server-only";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/realtime/server";
import type { TaskMutationResponse } from "@/types/board";
import { taskDetailInclude, toBoardTask, toTaskDetail } from "./dto";
import { HttpError } from "./http";
import { getSocketId } from "./validation";

export async function loadTask(taskId: string): Promise<TaskMutationResponse> {
  const row = await prisma.task.findUnique({ where: { id: taskId }, include: taskDetailInclude });
  if (!row) throw new HttpError(404, "Tarea no encontrada");
  return { task: toBoardTask(row), detail: toTaskDetail(row) };
}

/**
 * Cierre común de toda mutación sobre una tarea: recarga el estado
 * persistido, lo difunde al resto del equipo y lo devuelve al emisor.
 */
export async function respondWithTask(req: Request, taskId: string, projectId: string, status = 200) {
  const result = await loadTask(taskId);
  await broadcast(projectId, { type: "task:upserted", task: result.task }, getSocketId(req));
  return Response.json(result, { status });
}

/**
 * Comentarios y subtareas no tocan columnas de Task, así que forzamos
 * `updatedAt` para que los clientes detecten el cambio (el modal abierto
 * compara updatedAt para decidir si recargar el detalle).
 */
export function touchTask(taskId: string) {
  return prisma.task.update({ where: { id: taskId }, data: { updatedAt: new Date() } });
}
