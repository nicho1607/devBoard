import type { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/realtime/server";
import { requireTaskAccess } from "@/server/auth";
import { HttpError, route } from "@/server/http";
import { loadTask, respondWithTask } from "@/server/tasks";
import { getSocketId, updateTaskSchema } from "@/server/validation";

type Ctx = { params: Promise<{ taskId: string }> };

/** GET /api/tasks/:taskId — detalle completo para el modal. */
export const GET = route(async (_req, { params }: Ctx) => {
  const { taskId } = await params;
  await requireTaskAccess(taskId);
  return Response.json(await loadTask(taskId));
});

/** PATCH /api/tasks/:taskId — actualización parcial de campos + historial. */
export const PATCH = route(async (req, { params }: Ctx) => {
  const { taskId } = await params;
  const { user, project } = await requireTaskAccess(taskId);
  const input = updateTaskSchema.parse(await req.json());

  await prisma.$transaction(async (tx) => {
    const current = await tx.task.findUniqueOrThrow({
      where: { id: taskId },
      include: { assignees: true, labels: { include: { label: true } } },
    });

    const activities: { type: ActivityType; payload?: Prisma.InputJsonValue }[] = [];
    const data: Prisma.TaskUpdateInput = {};

    if (input.title !== undefined && input.title !== current.title) {
      data.title = input.title;
      activities.push({ type: "TITLE_CHANGED", payload: { from: current.title, to: input.title } });
    }
    if (input.description !== undefined && input.description !== current.description) {
      data.description = input.description;
      activities.push({ type: "DESCRIPTION_CHANGED" });
    }
    if (input.priority && input.priority !== current.priority) {
      data.priority = input.priority;
      activities.push({
        type: "PRIORITY_CHANGED",
        payload: { from: current.priority, to: input.priority },
      });
    }
    if (input.estimateUnit && input.estimateUnit !== current.estimateUnit) {
      data.estimateUnit = input.estimateUnit;
    }
    if (input.estimate !== undefined && input.estimate !== current.estimate) {
      data.estimate = input.estimate;
      activities.push({
        type: "ESTIMATE_CHANGED",
        payload: { from: current.estimate, to: input.estimate },
      });
    }

    if (input.assigneeIds) {
      const wanted = [...new Set(input.assigneeIds)];
      // Solo se puede asignar a miembros del workspace.
      const validCount = await tx.workspaceMember.count({
        where: { workspaceId: project.workspaceId, userId: { in: wanted } },
      });
      if (validCount !== wanted.length) throw new HttpError(400, "Asignado no pertenece al workspace");

      const currentIds = current.assignees.map((a) => a.userId);
      const added = wanted.filter((id) => !currentIds.includes(id));
      const removed = currentIds.filter((id) => !wanted.includes(id));
      if (removed.length) {
        await tx.taskAssignee.deleteMany({ where: { taskId, userId: { in: removed } } });
      }
      if (added.length) {
        await tx.taskAssignee.createMany({ data: added.map((userId) => ({ taskId, userId })) });
      }
      added.forEach((userId) => activities.push({ type: "ASSIGNEE_ADDED", payload: { userId } }));
      removed.forEach((userId) => activities.push({ type: "ASSIGNEE_REMOVED", payload: { userId } }));
    }

    if (input.labelIds) {
      const wanted = [...new Set(input.labelIds)];
      const labels = await tx.label.findMany({
        where: { workspaceId: project.workspaceId, id: { in: wanted } },
      });
      if (labels.length !== wanted.length) throw new HttpError(400, "Etiqueta inválida");

      const currentIds = current.labels.map((l) => l.labelId);
      const added = labels.filter((l) => !currentIds.includes(l.id));
      const removed = current.labels.filter((l) => !wanted.includes(l.labelId));
      if (removed.length) {
        await tx.taskLabel.deleteMany({
          where: { taskId, labelId: { in: removed.map((l) => l.labelId) } },
        });
      }
      if (added.length) {
        await tx.taskLabel.createMany({ data: added.map((l) => ({ taskId, labelId: l.id })) });
      }
      added.forEach((l) => activities.push({ type: "LABEL_ADDED", payload: { name: l.name } }));
      removed.forEach((l) =>
        activities.push({ type: "LABEL_REMOVED", payload: { name: l.label.name } }),
      );
    }

    // Siempre tocamos updatedAt (también si solo cambiaron relaciones N:M).
    await tx.task.update({ where: { id: taskId }, data: { ...data, updatedAt: new Date() } });
    if (activities.length) {
      await tx.activity.createMany({
        data: activities.map((a) => ({ ...a, taskId, actorId: user.id })),
      });
    }
  });

  return respondWithTask(req, taskId, project.id);
});

/** DELETE /api/tasks/:taskId — solo admins o el creador de la tarea. */
export const DELETE = route(async (req, { params }: Ctx) => {
  const { taskId } = await params;
  const { user, project, membership, task } = await requireTaskAccess(taskId);
  if (membership.role !== "ADMIN" && task.creatorId !== user.id) {
    throw new HttpError(403, "Solo un admin o el creador puede eliminar la tarea");
  }
  await prisma.task.delete({ where: { id: taskId } });
  await broadcast(project.id, { type: "task:deleted", taskId }, getSocketId(req));
  return new Response(null, { status: 204 });
});
