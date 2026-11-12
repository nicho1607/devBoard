import { prisma } from "@/lib/prisma";
import { positionBetween } from "@/lib/ordering";
import { requireProjectAccess } from "@/server/auth";
import { HttpError, route } from "@/server/http";
import { respondWithTask } from "@/server/tasks";
import { createTaskSchema } from "@/server/validation";

type Ctx = { params: Promise<{ projectId: string }> };

/** POST /api/projects/:projectId/tasks — crea una tarea al final de la columna. */
export const POST = route(async (req, { params }: Ctx) => {
  const { projectId } = await params;
  const { user, project } = await requireProjectAccess(projectId);
  const input = createTaskSchema.parse(await req.json());

  const task = await prisma.$transaction(async (tx) => {
    const column = await tx.column.findFirst({
      where: { id: input.columnId, projectId: project.id },
      select: { id: true },
    });
    if (!column) throw new HttpError(400, "Columna inválida");

    // El increment atómico serializa la numeración DEV-1, DEV-2, ...
    const { taskCounter } = await tx.project.update({
      where: { id: project.id },
      data: { taskCounter: { increment: 1 } },
      select: { taskCounter: true },
    });
    const last = await tx.task.findFirst({
      where: { columnId: column.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const created = await tx.task.create({
      data: {
        number: taskCounter,
        title: input.title,
        priority: input.priority,
        position: positionBetween(last?.position ?? null, null),
        projectId: project.id,
        columnId: column.id,
        creatorId: user.id,
      },
    });
    await tx.activity.create({ data: { type: "CREATED", taskId: created.id, actorId: user.id } });
    return created;
  });

  return respondWithTask(req, task.id, project.id, 201);
});
