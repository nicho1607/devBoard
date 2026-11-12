"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { SubtaskDTO } from "@/types/board";
import type { Mutate } from "./task-detail-modal";

type Props = { taskId: string; subtasks: SubtaskDTO[]; mutate: Mutate };

export function SubtaskChecklist({ taskId, subtasks, mutate }: Props) {
  const [title, setTitle] = useState("");
  // Estado optimista local para que el check sea instantáneo.
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});

  const items = subtasks.map((s) => ({ ...s, done: optimistic[s.id] ?? s.done }));
  const done = items.filter((s) => s.done).length;
  const percent = items.length ? Math.round((done / items.length) * 100) : 0;

  async function toggle(id: string, value: boolean) {
    setOptimistic((o) => ({ ...o, [id]: value }));
    await mutate(`/api/subtasks/${id}`, "PATCH", { done: value });
    setOptimistic(({ [id]: _, ...rest }) => rest);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = title.trim();
    if (!value) return;
    setTitle("");
    if (!(await mutate(`/api/tasks/${taskId}/subtasks`, "POST", { title: value }))) setTitle(value);
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Subtareas</h3>
        {items.length > 0 && (
          <span className="font-mono text-xs text-muted-foreground">
            {done}/{items.length} · {percent}%
          </span>
        )}
      </div>
      {items.length > 0 && (
        <Progress
          value={percent}
          className={cn("mb-3 h-1.5", percent === 100 && "[&>div]:bg-emerald-500")}
        />
      )}

      <ul className="space-y-1">
        {items.map((s) => (
          <li key={s.id} className="group flex items-center gap-2 rounded px-1 py-1 hover:bg-muted/40">
            <Checkbox
              id={`subtask-${s.id}`}
              checked={s.done}
              onCheckedChange={(v) => toggle(s.id, v === true)}
            />
            <label
              htmlFor={`subtask-${s.id}`}
              className={cn("flex-1 text-sm", s.done && "text-muted-foreground line-through")}
            >
              {s.title}
            </label>
            <button
              type="button"
              aria-label={`Eliminar ${s.title}`}
              onClick={() => mutate(`/api/subtasks/${s.id}`, "DELETE")}
              className="text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-red-400 focus:opacity-100"
            >
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="mt-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="+ Añadir subtarea"
          className="h-8 border-dashed text-sm"
        />
      </form>
    </section>
  );
}
