"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { useBoardStore } from "@/stores/board-store";
import type { TaskMutationResponse } from "@/types/board";

export function QuickAddTask({ columnId }: { columnId: string }) {
  const projectId = useBoardStore((s) => s.projectId);
  const upsertTask = useBoardStore((s) => s.upsertTask);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setPending(true);
    try {
      const { task } = await api<TaskMutationResponse>(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        body: { title, columnId },
      });
      upsertTask(task);
      setTitle("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la tarea");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" /> Nueva tarea
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Input
        autoFocus
        value={title}
        disabled={pending}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        onBlur={() => !title && setOpen(false)}
        placeholder="Título de la tarea…"
        className="h-8 text-sm"
      />
    </form>
  );
}
