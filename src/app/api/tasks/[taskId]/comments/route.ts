import { prisma } from "@/lib/prisma";
import { requireTaskAccess } from "@/server/auth";
import { route } from "@/server/http";
import { respondWithTask, touchTask } from "@/server/tasks";
import { createCommentSchema } from "@/server/validation";

type Ctx = { params: Promise<{ taskId: string }> };

/** El body es Markdown; se renderiza con react-markdown (sin HTML crudo → sin XSS). */
export const POST = route(async (req, { params }: Ctx) => {
  const { taskId } = await params;
  const { user, project } = await requireTaskAccess(taskId);
  const { body } = createCommentSchema.parse(await req.json());

  await prisma.$transaction([
    prisma.comment.create({ data: { taskId, body, authorId: user.id } }),
    touchTask(taskId),
  ]);
  return respondWithTask(req, taskId, project.id, 201);
});
