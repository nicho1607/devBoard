"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { EstimateUnit, Priority } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LabelChip } from "@/components/shared/label-chip";
import { UserAvatar } from "@/components/shared/user-avatar";
import { api } from "@/lib/api-client";
import { comparePosition } from "@/lib/ordering";
import { PRIORITIES, PRIORITY_META } from "@/lib/priority";
import { cn } from "@/lib/utils";
import { useBoardStore, useBoardStoreApi } from "@/stores/board-store";
import type { BoardEvent } from "@/lib/realtime/events";
import type { TaskDetail } from "@/types/board";
import type { Mutate } from "./task-detail-modal";

type Props = { task: TaskDetail; mutate: Mutate; onDelete: () => void };

export function TaskProperties({ task, mutate, onDelete }: Props) {
  const storeApi = useBoardStoreApi();
  const columns = useBoardStore((s) => s.columns);
  const members = useBoardStore((s) => s.members);
  const labels = useBoardStore((s) => s.labels);
  const currentUserId = useBoardStore((s) => s.currentUserId);
  const me = members.find((m) => m.id === currentUserId);
  const canDelete = me?.role === "ADMIN" || task.creator.id === currentUserId;
  const url = `/api/tasks/${task.id}`;

  /** Cambiar estado desde el modal = mover al final de la columna destino. */
  async function changeStatus(columnId: string) {
    const { tasks, upsertTask } = storeApi.getState();
    const last = Object.values(tasks)
      .filter((t) => t.columnId === columnId && t.id !== task.id)
      .sort(comparePosition)
      .at(-1);
    try {
      const res = await api<Omit<Extract<BoardEvent, { type: "task:moved" }>, "type">>(
        `${url}/move`,
        { method: "PATCH", body: { columnId, prevTaskId: last?.id ?? null, nextTaskId: null } },
      );
      upsertTask(res.task); // el modal detecta el nuevo updatedAt y recarga el detalle
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado");
    }
  }

  const assigneeIds = task.assignees.map((a) => a.id);
  const labelIds = task.labels.map((l) => l.id);
  const toggleIn = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  return (
    <dl className="space-y-5 text-sm">
      <Field label="Estado">
        <Select value={task.columnId} onValueChange={changeStatus}>
          <SelectTrigger className="h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {columns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Prioridad">
        <Select value={task.priority} onValueChange={(v) => mutate(url, "PATCH", { priority: v as Priority })}>
          <SelectTrigger className="h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORITIES.map((p) => {
              const meta = PRIORITY_META[p];
              const Icon = meta.icon;
              return (
                <SelectItem key={p} value={p}>
                  <span className={cn("flex items-center gap-2", meta.text)}>
                    <Icon className="size-4" /> {meta.label}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Asignados">
        <div className="flex flex-wrap items-center gap-1.5">
          {task.assignees.map((a) => (
            <span key={a.id} className="flex items-center gap-1.5 rounded-full bg-muted py-0.5 pr-2 pl-0.5">
              <UserAvatar user={a} className="size-5 ring-0" />
              <span className="text-xs">{a.name}</span>
            </span>
          ))}
          <MultiPicker
            placeholder="Buscar miembro…"
            options={members.map((m) => ({
              id: m.id,
              search: `${m.name} ${m.githubLogin ?? ""}`,
              node: (
                <span className="flex items-center gap-2">
                  <UserAvatar user={m} className="size-5 ring-0" /> {m.name}
                </span>
              ),
            }))}
            selected={assigneeIds}
            onToggle={(id) => mutate(url, "PATCH", { assigneeIds: toggleIn(assigneeIds, id) })}
          />
        </div>
      </Field>

      <Field label="Etiquetas">
        <div className="flex flex-wrap items-center gap-1.5">
          {task.labels.map((l) => (
            <LabelChip key={l.id} label={l} />
          ))}
          <MultiPicker
            placeholder="Buscar etiqueta…"
            options={labels.map((l) => ({ id: l.id, search: l.name, node: <LabelChip label={l} /> }))}
            selected={labelIds}
            onToggle={(id) => mutate(url, "PATCH", { labelIds: toggleIn(labelIds, id) })}
          />
        </div>
      </Field>

      <Field label="Estimación">
        <EstimateInput
          value={task.estimate}
          unit={task.estimateUnit}
          onSave={(estimate, estimateUnit) => mutate(url, "PATCH", { estimate, estimateUnit })}
        />
      </Field>

      <Field label="Creada">
        <span className="flex items-center gap-2 text-muted-foreground">
          <UserAvatar user={task.creator} className="size-5 ring-0" />
          {format(new Date(task.createdAt), "d MMM yyyy", { locale: es })}
        </span>
      </Field>

      {canDelete && (
        <Button variant="ghost" size="sm" onClick={onDelete} className="w-full text-red-400 hover:text-red-300">
          <Trash2 className="size-4" /> Eliminar tarea
        </Button>
      )}
    </dl>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function MultiPicker(props: {
  placeholder: string;
  options: { id: string; search: string; node: React.ReactNode }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="size-6 rounded-full" aria-label={props.placeholder}>
          <Plus className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command>
          <CommandInput placeholder={props.placeholder} />
          <CommandList>
            <CommandEmpty>Sin resultados</CommandEmpty>
            <CommandGroup>
              {props.options.map((o) => (
                <CommandItem key={o.id} value={o.search} onSelect={() => props.onToggle(o.id)}>
                  <Check className={cn("size-4", props.selected.includes(o.id) ? "opacity-100" : "opacity-0")} />
                  {o.node}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function EstimateInput(props: {
  value: number | null;
  unit: EstimateUnit;
  onSave: (value: number | null, unit: EstimateUnit) => void;
}) {
  const [draft, setDraft] = useState(props.value?.toString() ?? "");
  useEffect(() => setDraft(props.value?.toString() ?? ""), [props.value]);

  function commit(unit = props.unit) {
    const parsed = draft.trim() === "" ? null : Number(draft);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      setDraft(props.value?.toString() ?? "");
      return;
    }
    if (parsed !== props.value || unit !== props.unit) props.onSave(parsed, unit);
  }

  return (
    <div className="flex gap-2">
      <Input
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        placeholder="—"
        className="h-8 w-20 font-mono"
      />
      <Select value={props.unit} onValueChange={(u) => commit(u as EstimateUnit)}>
        <SelectTrigger className="h-8 flex-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="POINTS">Puntos</SelectItem>
          <SelectItem value="HOURS">Horas</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
