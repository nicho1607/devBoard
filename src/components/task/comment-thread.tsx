"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/shared/markdown";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { CommentDTO } from "@/types/board";
import type { Mutate } from "./task-detail-modal";

type Props = { taskId: string; comments: CommentDTO[]; mutate: Mutate };

export function CommentThread({ taskId, comments, mutate }: Props) {
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!body.trim()) return;
    setPending(true);
    if (await mutate(`/api/tasks/${taskId}/comments`, "POST", { body })) setBody("");
    setPending(false);
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-4">
        {comments.map((c) => (
          <li key={c.id} className="flex gap-3">
            <UserAvatar user={c.author} className="size-7" />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-baseline gap-2 text-xs">
                <span className="font-medium">{c.author.name}</span>
                <time dateTime={c.createdAt} className="text-muted-foreground">
                  {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true, locale: es })}
                </time>
              </div>
              <div className="rounded-md border bg-card px-3 py-2">
                <Markdown>{c.body}</Markdown>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
          }}
          placeholder={"Escribe un comentario… usa ```ts para bloques de código"}
          className="min-h-20 font-mono text-sm"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Markdown · Ctrl+Enter para enviar</span>
          <Button size="sm" onClick={submit} disabled={pending || !body.trim()}>
            Comentar
          </Button>
        </div>
      </div>
    </div>
  );
}
