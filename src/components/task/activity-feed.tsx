"use client";

import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type { Priority } from "@prisma/client";
import { UserAvatar } from "@/components/shared/user-avatar";
import { PRIORITY_META } from "@/lib/priority";
import { useBoardStore } from "@/stores/board-store";
import type { ActivityDTO, MemberDTO } from "@/types/board";

type P = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? "—" : String(v));

function describe(a: ActivityDTO, members: MemberDTO[]): React.ReactNode {
  const p = (a.payload ?? {}) as P;
  const memberName = (id: unknown) => members.find((m) => m.id === id)?.name ?? "alguien";
  switch (a.type) {
    case "CREATED":
      return "creó la tarea";
    case "STATUS_CHANGED":
      return (
        <>
          movió de <b>{str((p.from as P)?.name)}</b> a <b>{str((p.to as P)?.name)}</b>
        </>
      );
    case "TITLE_CHANGED":
      return <>renombró la tarea a “{str(p.to)}”</>;
    case "DESCRIPTION_CHANGED":
      return "editó la descripción";
    case "PRIORITY_CHANGED":
      return (
        <>
          cambió la prioridad a <b>{PRIORITY_META[p.to as Priority]?.label ?? str(p.to)}</b>
        </>
      );
    case "ESTIMATE_CHANGED":
      return <>cambió la estimación de {str(p.from)} a {str(p.to)}</>;
    case "ASSIGNEE_ADDED":
      return <>asignó a {memberName(p.userId)}</>;
    case "ASSIGNEE_REMOVED":
      return <>desasignó a {memberName(p.userId)}</>;
    case "LABEL_ADDED":
      return <>añadió la etiqueta {str(p.name)}</>;
    case "LABEL_REMOVED":
      return <>quitó la etiqueta {str(p.name)}</>;
  }
}

export function ActivityFeed({ activities }: { activities: ActivityDTO[] }) {
  const members = useBoardStore((s) => s.members);
  if (!activities.length) return <p className="text-sm text-muted-foreground">Sin actividad.</p>;

  return (
    <ol className="relative space-y-3 border-l pl-4">
      {activities.map((a) => (
        <li key={a.id} className="relative flex items-center gap-2 text-sm">
          <span className="absolute -left-[21px] size-2 rounded-full bg-border" />
          <UserAvatar user={a.actor} className="size-5" />
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{a.actor.name}</span> {describe(a, members)}
          </span>
          <time dateTime={a.createdAt} className="ml-auto shrink-0 text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true, locale: es })}
          </time>
        </li>
      ))}
    </ol>
  );
}
