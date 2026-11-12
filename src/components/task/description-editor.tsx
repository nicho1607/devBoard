"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/shared/markdown";

type Props = { value: string; onSave: (value: string) => Promise<boolean> };

/** Vista Markdown renderizada; clic para editar. Cmd/Ctrl+Enter guarda. */
export function DescriptionEditor({ value, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  async function save() {
    setSaving(true);
    const ok = draft === value || (await onSave(draft));
    setSaving(false);
    if (ok) setEditing(false);
  }

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Descripción
      </h3>
      {editing ? (
        <div className="space-y-2">
          <Textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void save();
              if (e.key === "Escape") {
                e.stopPropagation(); // no cerrar el modal
                setDraft(value);
                setEditing(false);
              }
            }}
            placeholder="Describe la tarea… Soporta **Markdown** y ```bloques de código```"
            className="min-h-40 font-mono text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>
              Guardar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="block w-full rounded-md p-2 -m-2 text-left hover:bg-muted/40"
        >
          {value ? (
            <Markdown>{value}</Markdown>
          ) : (
            <span className="text-sm text-muted-foreground">Añadir una descripción…</span>
          )}
        </button>
      )}
    </section>
  );
}
