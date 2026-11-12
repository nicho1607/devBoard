import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { needsRebalance, POSITION_STEP, positionBetween } from "@/lib/ordering";
import { broadcast } from "@/lib/realtime/server";
import { requireTaskAccess } from "@/server/auth";
import { boardTaskInclude, toBoardTask } from "@/server/dto";
import { HttpError, route } from "@/server/http";
import { getSocketId, moveTaskSchema } from "@/server/validation";

type Ctx = { params: Promise<{ taskId: string }> };

/**
 * PATCH /api/tasks/:taskId/move
 * Body: { columnId, prevTaskId, nextTaskId }
 *
 * El cliente envía los vecinos que VE tras soltar (no un índice), porque con
 * filtros activos el índice visual no coincide con el índice real. El servidor
 * calcula la posición como punto medio entre esos vecinos → es la fuente de verdad.
 *
 * Flujo:
 *   1. Autoriza (miembro del workspace) y valida.
 *   2. En una transacción: valida columna y vecinos, calcula posición
 *      (rebalanceando la columna si el hueco se agotó), actualiza la tarea
 *      y registra Activity si cambió de estado.
 *   3. Difunde `task:moved` por Pusher excluyendo al emisor (ya aplicó el
 *      cambio de forma optimista) y responde con la tarea final.
 *
 * 409 → los vecinos ya no están donde el cliente creía (otro usuario movió
 * algo a la vez). El cliente revierte y resincroniza.
 */
export const PATCH = route(async (req, { params }: Ctx) => {
  const { taskId } = await params;
  const { user, project } = await requireTaskAccess(taskId);
  const input = moveTaskSchema.parse(await req.json());

  const result = await prisma.$transaction(async (tx) => {
    const task = await tx.task.findUniqueOrThrow({
      where: { id: taskId },
      select: { columnId: true, column: { select: { id: true, name: true, kind: true } } },
    });
    const target = await tx.column.findFirst({
      where: { id: input.columnId, projectId: project.id },
      select: { id: true, name: true, kind: true },
    });
    if (!target) throw new HttpError(400, "Columna inválida");

    let { prev, next } = await resolveNeighbors(tx, input, target.id, taskId);
    let rebalanced: { id: string; position: number }[] | undefined;

    if (needsRebalance(prev, next)) {
      rebalanced = await rebalanceColumn(tx, target.id, taskId);
      const byId = new Map(rebalanced.map((r) => [r.id, r.position]));
      prev = input.prevTaskId ? byId.get(input.prevTaskId)! : null;
      next = input.nextTaskId ? byId.get(input.nextTaskId)! : null;
    }

    let position: number;
    if (prev === null && next === null) {
      // Columna vacía (o vacía en la vista filtrada): al final de la columna real.
      const last = await tx.task.findFirst({
        where: { columnId: target.id, NOT: { id: taskId } },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      position = positionBetween(last?.position ?? null, null);
    } else {
      position = positionBetween(prev, next);
    }

    const statusChanged = task.columnId !== target.id;
    const enteringDone = statusChanged && target.kind === "DONE";
    const leavingDone = statusChanged && task.column.kind === "DONE";

    const updated = await tx.task.update({
      where: { id: taskId },
      data: {
        columnId: target.id,
        position,
        ...(enteringDone && { completedAt: new Date() }),
        ...(leavingDone && { completedAt: null }),
      },
      include: boardTaskInclude,
    });

    if (statusChanged) {
      await tx.activity.create({
        data: {
          type: "STATUS_CHANGED",
          taskId,
          actorId: user.id,
          payload: {
            from: { id: task.column.id, name: task.column.name },
            to: { id: target.id, name: target.name },
          },
        },
      });
    }

    return { task: toBoardTask(updated), rebalanced };
  });

  await broadcast(project.id, { type: "task:moved", ...result }, getSocketId(req));
  return Response.json(result);
});

async function resolveNeighbors(
  tx: Prisma.TransactionClient,
  input: { prevTaskId: string | null; nextTaskId: string | null },
  columnId: string,
  taskId: string,
) {
  const ids = [input.prevTaskId, input.nextTaskId].filter((id): id is string => Boolean(id));
  if (ids.includes(taskId)) throw new HttpError(400, "Una tarea no puede ser su propio vecino");

  const rows = ids.length
    ? await tx.task.findMany({
        where: { id: { in: ids }, columnId },
        select: { id: true, position: true },
      })
    : [];
  if (rows.length !== ids.length) throw new HttpError(409, "El tablero cambió; resincronizando");

  const prev = rows.find((r) => r.id === input.prevTaskId)?.position ?? null;
  const next = rows.find((r) => r.id === input.nextTaskId)?.position ?? null;
  if (prev !== null && next !== null && prev > next) {
    throw new HttpError(409, "El tablero cambió; resincronizando");
  }
  return { prev, next };
}

/** Reasigna posiciones equiespaciadas (1024, 2048, ...) preservando el orden. */
async function rebalanceColumn(tx: Prisma.TransactionClient, columnId: string, excludeId: string) {
  const tasks = await tx.task.findMany({
    where: { columnId, NOT: { id: excludeId } },
    orderBy: [{ position: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  const positions = tasks.map((t, i) => ({ id: t.id, position: (i + 1) * POSITION_STEP }));
  await Promise.all(
    positions.map((p) =>
      tx.task.update({ where: { id: p.id }, data: { position: p.position } }),
    ),
  );
  return positions;
}
