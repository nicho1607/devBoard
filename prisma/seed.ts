import { PrismaClient, type ColumnKind, type Priority } from "@prisma/client";

const prisma = new PrismaClient();

const COLUMNS: { name: string; kind: ColumnKind; wipLimit?: number }[] = [
  { name: "Backlog", kind: "BACKLOG" },
  { name: "To Do", kind: "TODO" },
  { name: "In Progress", kind: "IN_PROGRESS", wipLimit: 4 },
  { name: "Code Review", kind: "REVIEW", wipLimit: 3 },
  { name: "Done", kind: "DONE" },
];

const LABELS = [
  { name: "Bug", color: "#f87171" },
  { name: "Feature", color: "#a78bfa" },
  { name: "Refactor", color: "#38bdf8" },
  { name: "Docs", color: "#4ade80" },
  { name: "Chore", color: "#a1a1aa" },
];

const TASKS: { title: string; col: ColumnKind; priority: Priority; labels: string[]; estimate?: number }[] = [
  { title: "Configurar CI con GitHub Actions", col: "DONE", priority: "MEDIUM", labels: ["Chore"], estimate: 2 },
  { title: "Login con GitHub OAuth", col: "REVIEW", priority: "HIGH", labels: ["Feature"], estimate: 3 },
  { title: "Drag & drop entre columnas", col: "IN_PROGRESS", priority: "HIGH", labels: ["Feature"], estimate: 5 },
  { title: "El contador de subtareas no se actualiza", col: "TODO", priority: "URGENT", labels: ["Bug"], estimate: 1 },
  { title: "Extraer hooks de realtime", col: "TODO", priority: "LOW", labels: ["Refactor"], estimate: 2 },
  { title: "Documentar el modelo de datos", col: "BACKLOG", priority: "LOW", labels: ["Docs"] },
  { title: "Filtros por etiqueta y asignado", col: "BACKLOG", priority: "MEDIUM", labels: ["Feature"], estimate: 3 },
];

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  if (!email) throw new Error("Define SEED_ADMIN_EMAIL en .env");

  // Sin clerkId: se enlaza automáticamente al hacer login con este email.
  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: email.split("@")[0] },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: "acme" },
    update: {},
    create: {
      name: "Acme Engineering",
      slug: "acme",
      members: { create: { userId: admin.id, role: "ADMIN" } },
      labels: { create: LABELS },
    },
    include: { labels: true },
  });

  const existing = await prisma.project.findUnique({
    where: { workspaceId_key: { workspaceId: workspace.id, key: "DEV" } },
  });
  if (existing) {
    console.log("Seed ya aplicado.");
    return;
  }

  const project = await prisma.project.create({
    data: {
      name: "DevBoard Web",
      key: "DEV",
      workspaceId: workspace.id,
      columns: { create: COLUMNS.map((c, i) => ({ ...c, position: (i + 1) * 1024 })) },
    },
    include: { columns: true },
  });

  for (const [i, t] of TASKS.entries()) {
    const column = project.columns.find((c) => c.kind === t.col)!;
    await prisma.task.create({
      data: {
        number: i + 1,
        title: t.title,
        priority: t.priority,
        estimate: t.estimate,
        position: (i + 1) * 1024,
        projectId: project.id,
        columnId: column.id,
        creatorId: admin.id,
        completedAt: t.col === "DONE" ? new Date() : null,
        assignees: { create: [{ userId: admin.id }] },
        labels: {
          create: workspace.labels
            .filter((l) => t.labels.includes(l.name))
            .map((l) => ({ labelId: l.id })),
        },
        subtasks:
          i === 2
            ? {
                create: [
                  { title: "Integrar @hello-pangea/dnd", done: true, position: 1024 },
                  { title: "Update optimista + rollback", done: true, position: 2048 },
                  { title: "Broadcast por Pusher", done: false, position: 3072 },
                ],
              }
            : undefined,
        activities: { create: { type: "CREATED", actorId: admin.id } },
      },
    });
  }
  await prisma.project.update({ where: { id: project.id }, data: { taskCounter: TASKS.length } });
  console.log(`Seed OK → /w/acme/p/DEV (admin: ${email})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
