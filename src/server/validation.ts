import { z } from "zod";
import { EstimateUnit, Priority } from "@prisma/client";

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  columnId: z.string().min(1),
  priority: z.nativeEnum(Priority).optional(),
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(20_000).nullable(),
    priority: z.nativeEnum(Priority),
    estimate: z.number().min(0).max(1000).nullable(),
    estimateUnit: z.nativeEnum(EstimateUnit),
    assigneeIds: z.array(z.string()).max(10),
    labelIds: z.array(z.string()).max(20),
  })
  .partial();

export const moveTaskSchema = z.object({
  columnId: z.string().min(1),
  /** Vecinos visibles en el destino tras soltar (null = extremo de la lista). */
  prevTaskId: z.string().nullable(),
  nextTaskId: z.string().nullable(),
});

export const createSubtaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

export const updateSubtaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  done: z.boolean().optional(),
});

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
});

/** El cliente envía su socket_id de Pusher para no recibir el eco de sus cambios. */
export function getSocketId(req: Request) {
  return req.headers.get("x-socket-id")?.slice(0, 64) || undefined;
}
