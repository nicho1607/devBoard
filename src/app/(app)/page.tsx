import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/server/auth";

/** Home: lista de workspaces y proyectos del usuario. */
export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const workspaces = await prisma.workspace.findMany({
    where: { members: { some: { userId: user.id } } },
    include: { projects: { orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <h1 className="text-2xl font-semibold">Tus espacios de trabajo</h1>
      {workspaces.length === 0 && (
        <p className="text-muted-foreground">
          Aún no perteneces a ningún workspace. Pide a un admin que te invite.
        </p>
      )}
      {workspaces.map((ws) => (
        <section key={ws.id} className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{ws.name}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {ws.projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/w/${ws.slug}/p/${p.key}`}
                  className="block rounded-lg border bg-card p-4 transition hover:border-primary/50"
                >
                  <span className="font-mono text-xs text-muted-foreground">{p.key}</span>
                  <p className="font-medium">{p.name}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
