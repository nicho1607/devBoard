import type { BoardTask } from "@/types/board";

// Contrato de eventos en tiempo real (compartido cliente/servidor).
// Un canal privado por proyecto: solo miembros del workspace pueden suscribirse.

export const projectChannel = (projectId: string) => `private-project-${projectId}`;
export const PROJECT_CHANNEL_RE = /^private-project-([a-z0-9]+)$/;

export type BoardEvent =
  | { type: "task:upserted"; task: BoardTask }
  | {
      type: "task:moved";
      task: BoardTask;
      /** Presente si el servidor tuvo que rebalancear la columna destino. */
      rebalanced?: { id: string; position: number }[];
    }
  | { type: "task:deleted"; taskId: string };

export type BoardEventType = BoardEvent["type"];
export const BOARD_EVENT_TYPES: BoardEventType[] = ["task:upserted", "task:moved", "task:deleted"];
