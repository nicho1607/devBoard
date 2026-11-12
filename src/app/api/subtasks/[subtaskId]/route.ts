import { prisma } from "@/lib/prisma";
import { requireTaskAccess } from "@/server/auth";
import { HttpError, route } from "@/server/http";
import { respondWithTask, touchTask } from "@/server/tasks";
import { updateSubtaskSchema } from "@/server/validation";

type Ctx = { params: Promise<{ subtaskId: string }> };

async function requireSubtaskAccess(subtaskId: string) {
  const subtask = await prisma.subtask.findUnique({
    where: { id: subtaskId },
    select: { taskId: true },
  });
  if (!subtask) throw new HttpError(404, "Subtarea no encontrada");
  return requireTaskAccess(subtask.taskId);
}

export const PATCH = route(async (req, { params }: Ctx) => {
  const { subtaskId } = await params;
  const { project, task } = await requireSubtaskAccess(subtaskId);
  const input = updateSubtaskSchema.parse(await req.json());

  await prisma.$transaction([
    prisma.subtask.update({ where: { id: subtaskId }, data: input }),
    touchTask(task.id),
  ]);
  return respondWithTask(req, task.id, project.id);
});

export const DELETE = route(async (req, { params }: Ctx) => {
  const { subtaskId } = await params;
  const { project, task } = await requireSubtaskAccess(subtaskId);

  await prisma.$transaction([
    prisma.subtask.delete({ where: { id: subtaskId } }),
    touchTask(task.id),
  ]);
  return respondWithTask(req, task.id, project.id);
});
