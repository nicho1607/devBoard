import type { Priority } from "@prisma/client";
import type { BoardTask } from "@/types/board";

export type BoardFilters = {
  q: string;
  assignees: string[]; // userIds; "none" = sin asignar
  priorities: Priority[];
  labels: string[]; // labelIds
};

const list = (value: string | null) => (value ? value.split(",").filter(Boolean) : []);

/** Los filtros viven en la URL → enlaces compartibles y back/forward funcionan. */
export function parseFilters(params: URLSearchParams): BoardFilters {
  return {
    q: params.get("q") ?? "",
    assignees: list(params.get("assignee")),
    priorities: list(params.get("priority")) as Priority[],
    labels: list(params.get("label")),
  };
}

export function hasActiveFilters(f: BoardFilters) {
  return Boolean(f.q || f.assignees.length || f.priorities.length || f.labels.length);
}

export function matchesFilters(task: BoardTask, f: BoardFilters): boolean {
  if (f.q) {
    const q = f.q.toLowerCase();
    if (!task.title.toLowerCase().includes(q) && !task.key.toLowerCase().includes(q)) return false;
  }
  if (f.priorities.length && !f.priorities.includes(task.priority)) return false;
  if (f.assignees.length) {
    const ids = task.assignees.map((a) => a.id);
    const ok = f.assignees.some((id) => (id === "none" ? ids.length === 0 : ids.includes(id)));
    if (!ok) return false;
  }
  // Etiquetas: la tarea debe tener TODAS las seleccionadas (AND), lo esperable al acotar.
  if (f.labels.length) {
    const ids = new Set(task.labels.map((l) => l.id));
    if (!f.labels.every((id) => ids.has(id))) return false;
  }
  return true;
}
