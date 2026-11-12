import { prisma } from "@/lib/prisma";
import { positionBetween } from "@/lib/ordering";
import { requireTaskAccess } from "@/server/auth";
import { route } from "@/server/http";
import { respondWithTask, touchTask } from "@/server/tasks";
import { createSubtaskSchema } from "@/server/validation";

type Ctx = { params: Promise<{ taskId: string }> };

export const POST = route(async (req, { params }: Ctx) => {
  const { taskId } = await params;
  const { project } = await requireTaskAccess(taskId);
  const { title } = createSubtaskSchema.parse(await req.json());

  const last = await prisma.subtask.findFirst({
    where: { taskId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  await prisma.$transaction([
    prisma.subtask.create({
      data: { taskId, title, position: positionBetween(last?.position ?? null, null) },
    }),
    touchTask(taskId),
  ]);

  return respondWithTask(req, taskId, project.id, 201);
});
