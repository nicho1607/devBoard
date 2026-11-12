import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";
import type { UserSummary } from "@/types/board";

export function UserAvatar({ user, className }: { user: UserSummary; className?: string }) {
  return (
    <Avatar className={cn("size-6 ring-2 ring-background", className)} title={user.name ?? undefined}>
      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name ?? ""} />}
      <AvatarFallback className="text-[10px] font-medium">{initials(user.name)}</AvatarFallback>
    </Avatar>
  );
}

/** Avatares superpuestos con contador "+N" para tarjetas compactas. */
export function AvatarStack({ users, max = 3 }: { users: UserSummary[]; max?: number }) {
  if (!users.length) return null;
  const visible = users.slice(0, max);
  const extra = users.length - visible.length;
  return (
    <div className="flex -space-x-1.5" aria-label={users.map((u) => u.name).join(", ")}>
      {visible.map((u) => (
        <UserAvatar key={u.id} user={u} />
      ))}
      {extra > 0 && (
        <span className="grid size-6 place-items-center rounded-full bg-muted text-[10px] font-medium ring-2 ring-background">
          +{extra}
        </span>
      )}
    </div>
  );
}
