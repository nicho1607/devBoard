import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { ChevronRight } from "lucide-react";
import { BoardFilters } from "@/components/board/board-filters";
import { KanbanBoard } from "@/components/board/kanban-board";
import { AvatarStack } from "@/components/shared/user-avatar";
import { TaskDetailModal } from "@/components/task/task-detail-modal";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/server/auth";
import { boardTaskInclude, toBoardTask, userSummarySelect } from "@/server/dto";
import { BoardStoreProvider, type BoardInit } from "@/stores/board-store";

type Props = { params: Promise<{ workspaceSlug: string; projectKey: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { projectKey } = await params;
  return { title: projectKey.toUpperCase() };
}

export default async function BoardPage({ params }: Props) {
  const { workspaceSlug, projectKey } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  // El filtro por membresía va en la propia query: un no-miembro recibe 404.
  const project = await prisma.project.findFirst({
    where: {
      key: projectKey.toUpperCase(),
      workspace: { slug: workspaceSlug, members: { some: { userId: user.id } } },
    },
    include: {
      columns: { orderBy: { position: "asc" } },
      workspace: {
        include: {
          labels: { orderBy: { name: "asc" } },
          members: { include: { user: { select: userSummarySelect } } },
        },
      },
    },
  });
  if (!project) notFound();

  const tasks = await prisma.task.findMany({
    where: { projectId: project.id },
    include: boardTaskInclude,
    orderBy: [{ position: "asc" }, { id: "asc" }],
  });

  const init: BoardInit = {
    projectId: project.id,
    projectKey: project.key,
    currentUserId: user.id,
    columns: project.columns.map(({ id, name, kind, position, wipLimit }) => ({
      id,
      name,
      kind,
      position,
      wipLimit,
    })),
    tasks: tasks.map(toBoardTask),
    members: project.workspace.members.map((m) => ({ ...m.user, role: m.role })),
    labels: project.workspace.labels.map(({ id, name, color }) => ({ id, name, color })),
  };

  return (
    <BoardStoreProvider init={init}>
      <div className="flex h-dvh flex-col">
        <header className="flex items-center gap-2 border-b px-4 py-2.5 md:px-6">
          <nav className="flex min-w-0 items-center gap-1 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              {project.workspace.name}
            </Link>
            <ChevronRight className="size-4 text-muted-foreground" />
            <h1 className="truncate font-semibold">{project.name}</h1>
            <span className="ml-1 rounded bg-muted px-1.5 font-mono text-xs text-muted-foreground">
              {project.key}
            </span>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:block">
              <AvatarStack users={init.members} max={5} />
            </div>
            <UserButton />
          </div>
        </header>

        <BoardFilters />
        <main className="min-h-0 flex-1">
          <KanbanBoard />
        </main>
      </div>
      <TaskDetailModal />
    </BoardStoreProvider>
  );
}
