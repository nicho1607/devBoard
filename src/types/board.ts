import type { ActivityType, ColumnKind, EstimateUnit, Priority, Role } from "@prisma/client";

// DTOs serializables (cruzan la frontera servidor → cliente y viajan por Pusher).
// Las fechas van como string ISO.

export type UserSummary = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  githubLogin: string | null;
};

export type MemberDTO = UserSummary & { role: Role };

export type LabelDTO = { id: string; name: string; color: string };

export type BoardColumn = {
  id: string;
  name: string;
  kind: ColumnKind;
  position: number;
  wipLimit: number | null;
};

/** Versión "ligera" de la tarea que se pinta en la tarjeta del tablero. */
export type BoardTask = {
  id: string;
  key: string; // DEV-42
  number: number;
  title: string;
  priority: Priority;
  estimate: number | null;
  estimateUnit: EstimateUnit;
  position: number;
  columnId: string;
  assignees: UserSummary[];
  labels: LabelDTO[];
  subtaskTotal: number;
  subtaskDone: number;
  commentCount: number;
  updatedAt: string;
};

export type SubtaskDTO = { id: string; title: string; done: boolean; position: number };

export type CommentDTO = {
  id: string;
  body: string;
  author: UserSummary;
  createdAt: string;
  updatedAt: string;
};

export type ActivityDTO = {
  id: string;
  type: ActivityType;
  payload: Record<string, unknown> | null;
  actor: UserSummary;
  createdAt: string;
};

/** Versión completa que carga el modal de detalle. */
export type TaskDetail = BoardTask & {
  description: string | null;
  createdAt: string;
  creator: UserSummary;
  subtasks: SubtaskDTO[];
  comments: CommentDTO[];
  activities: ActivityDTO[];
};

export type BoardData = {
  projectId: string;
  columns: BoardColumn[];
  tasks: BoardTask[];
};

/** Respuesta estándar de los endpoints que mutan una tarea. */
export type TaskMutationResponse = { task: BoardTask; detail: TaskDetail };
