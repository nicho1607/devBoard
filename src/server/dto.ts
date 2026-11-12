import "server-only";
import type { Prisma } from "@prisma/client";
import type { ActivityDTO, BoardTask, TaskDetail } from "@/types/board";

export const userSummarySelect = {
  id: true,
  name: true,
  avatarUrl: true,
  githubLogin: true,
} satisfies Prisma.UserSelect;

export const boardTaskInclude = {
  project: { select: { key: true } },
  assignees: { include: { user: { select: userSummarySelect } }, orderBy: { assignedAt: "asc" } },
  labels: { include: { label: true } },
  subtasks: { select: { done: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.TaskInclude;

export const taskDetailInclude = {
  ...boardTaskInclude,
  creator: { select: userSummarySelect },
  subtasks: { orderBy: { position: "asc" } },
  comments: { include: { author: { select: userSummarySelect } }, orderBy: { createdAt: "asc" } },
  activities: {
    include: { actor: { select: userSummarySelect } },
    orderBy: { createdAt: "desc" },
    take: 50,
  },
} satisfies Prisma.TaskInclude;

type BoardTaskRow = Prisma.TaskGetPayload<{ include: typeof boardTaskInclude }>;
type TaskDetailRow = Prisma.TaskGetPayload<{ include: typeof taskDetailInclude }>;

export function toBoardTask(t: BoardTaskRow | TaskDetailRow): BoardTask {
  return {
    id: t.id,
    key: `${t.project.key}-${t.number}`,
    number: t.number,
    title: t.title,
    priority: t.priority,
    estimate: t.estimate,
    estimateUnit: t.estimateUnit,
    position: t.position,
    columnId: t.columnId,
    assignees: t.assignees.map((a) => a.user),
    labels: t.labels.map(({ label }) => ({ id: label.id, name: label.name, color: label.color })),
    subtaskTotal: t.subtasks.length,
    subtaskDone: t.subtasks.filter((s) => s.done).length,
    commentCount: t._count.comments,
    updatedAt: t.updatedAt.toISOString(),
  };
}

export function toTaskDetail(t: TaskDetailRow): TaskDetail {
  return {
    ...toBoardTask(t),
    description: t.description,
    createdAt: t.createdAt.toISOString(),
    creator: t.creator,
    subtasks: t.subtasks.map((s) => ({
      id: s.id,
      title: s.title,
      done: s.done,
      position: s.position,
    })),
    comments: t.comments.map((c) => ({
      id: c.id,
      body: c.body,
      author: c.author,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
    activities: t.activities.map(
      (a): ActivityDTO => ({
        id: a.id,
        type: a.type,
        payload: (a.payload as Record<string, unknown> | null) ?? null,
        actor: a.actor,
        createdAt: a.createdAt.toISOString(),
      }),
    ),
  };
}
