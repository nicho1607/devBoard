# DevBoard — Arquitectura

Tablero Kanban colaborativo en tiempo real para equipos de desarrollo.

| Capa | Elección | Motivo |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | RSC para la carga inicial, Route Handlers para la API |
| UI | Tailwind v4 + shadcn/ui, dark mode por defecto | Componentes accesibles (Radix) que el proyecto posee y puede editar |
| Drag & Drop | `@hello-pangea/dnd` | API específica para listas Kanban, teclado y táctil incluidos |
| Estado cliente | Zustand (un store por tablero, vía context) | Updates optimistas y eventos realtime sin re-renderizar todo |
| BD | PostgreSQL + Prisma 6 | Relaciones N:M, transacciones, tipos generados |
| Auth | Clerk (GitHub / Google OAuth) | OAuth sin mantener tablas de sesión |
| Realtime | Pusher Channels (canales privados) | Funciona en serverless (Vercel), sin servidor WS propio |

## 1. Modelo de datos

```
User ─< WorkspaceMember >─ Workspace ─< Project ─< Column ─< Task
                (role)          │           │                 │
                                └─< Label   └─< Sprint >──────┤ (opcional)
                                      │                       │
                                      └──< TaskLabel >────────┤  N:M
User ──< TaskAssignee >───────────────────────────────────────┤  N:M
                                                              ├─< Subtask
User ──< Comment >────────────────────────────────────────────┤
User ──< Activity (historial) >───────────────────────────────┘
```

- **Workspace ↔ User** es N:M a través de `WorkspaceMember`, que guarda el rol (`ADMIN` / `MEMBER`). La autorización siempre parte de aquí.
- **Project** pertenece a un workspace y tiene una clave corta (`DEV`) para numerar tareas como `DEV-42`. El número sale de `taskCounter` con un increment atómico.
- **Column** es una entidad (no un enum) para poder renombrarla, reordenarla y ponerle límite WIP. `kind` (`BACKLOG…DONE`) conserva su significado: entrar en `DONE` fija `completedAt`.
- **Task** guarda `position: Float` (indexación fraccional; ver §4).
- **Label** vive a nivel workspace y se reutiliza entre proyectos.
- **Activity** es el historial de cambios de cada tarea, con `payload` JSON (`{from, to}`).

Esquema completo: [prisma/schema.prisma](prisma/schema.prisma).

## 2. Estructura de carpetas

```
prisma/
  schema.prisma            modelo de datos
  seed.ts                  workspace "acme" + proyecto DEV de ejemplo
src/
  middleware.ts            Clerk: todo protegido salvo /sign-in
  app/
    layout.tsx             ClerkProvider (tema oscuro), fuentes, Toaster
    globals.css            tokens de shadcn + estilos Markdown
    (auth)/sign-in/…       página de login de Clerk
    (app)/page.tsx         lista de workspaces y proyectos
    (app)/w/[workspaceSlug]/p/[projectKey]/page.tsx
                           tablero: RSC que carga datos e hidrata el store
    api/
      projects/[projectId]/tasks   POST   crear tarea
      tasks/[taskId]               GET | PATCH | DELETE
      tasks/[taskId]/move          PATCH  mover/reordenar (tiempo real)
      tasks/[taskId]/subtasks      POST
      tasks/[taskId]/comments      POST
      subtasks/[subtaskId]         PATCH | DELETE
      pusher/auth                  POST   autoriza canales privados
  components/
    ui/                    shadcn (generado; editable)
    board/                 KanbanBoard, BoardColumn, TaskCard, BoardFilters, QuickAddTask
    task/                  TaskDetailModal + secciones (propiedades, subtareas, comentarios, historial)
    shared/                UserAvatar/AvatarStack, LabelChip, Markdown
  hooks/                   useBoardRealtime, useTaskModal
  stores/board-store.tsx   store Zustand por tablero
  lib/                     prisma, ordering, filters, priority, api-client, realtime/{events,server,client}
  server/                  solo servidor: auth (acceso), dto, http (errores), tasks, validation (zod)
  types/board.ts           DTOs compartidos cliente/servidor
```

Regla: `server/` y `lib/realtime/server.ts` importan `server-only`, así que no pueden acabar por error en el bundle del cliente. Los tipos que cruzan la red viven en `types/`.

## 3. Flujo en tiempo real (mover una tarea)

```
Usuario A suelta la tarjeta
  │ 1. el store se actualiza al instante (optimista)
  │ 2. PATCH /api/tasks/:id/move { columnId, prevTaskId, nextTaskId }
  │      cabecera x-socket-id: <socket de A>
  ▼
Servidor (transacción)
  - comprueba que A es miembro del workspace
  - comprueba que la columna y los vecinos siguen ahí (si no → 409)
  - position = punto medio(prev, next), rebalanceando la columna si hace falta
  - actualiza la tarea y, si cambió de columna, crea una Activity STATUS_CHANGED
  │ 3. Pusher trigger "task:moved" en private-project-{id}, excluyendo a A
  │ 4. responde a A con la tarea autoritativa
  ▼
Usuarios B, C…  useBoardRealtime → store.upsertTask → la tarjeta se mueve
```

- **Errores:** si falla, A vuelve al snapshot. Con 409 (otro usuario cambió esa zona) se hace `router.refresh()` para resincronizar.
- **Orden de los eventos:** `upsertTask` descarta eventos con un `updatedAt` más antiguo que el que ya tiene.
- **Reconexión:** al pasar de desconectado a conectado se vuelve a pedir el tablero completo, porque mientras tanto pudieron perderse eventos.
- **Modal abierto:** si llega un evento con un `updatedAt` más nuevo para la tarea abierta, el modal recarga el detalle (comentarios, subtareas, historial).
- Todas las demás mutaciones (PATCH, subtareas, comentarios, crear) usan el mismo patrón a través de `respondWithTask` y emiten `task:upserted`.

## 4. Decisiones clave

- **Indexación fraccional en lugar de índices enteros.** Mover una tarea es un solo `UPDATE`, no renumerar toda la columna. Cuando el hueco baja de 1e-6 (unas 50 inserciones en el mismo punto), se rebalancea la columna en la misma transacción y se emiten las nuevas posiciones.
- **Vecinos en lugar de índice.** Con filtros activos, el índice que se ve no es el real. Enviar `prevTaskId/nextTaskId` funciona igual con o sin filtro.
- **Filtros en la URL** (`?q=&assignee=&priority=&label=`) y filtrado en cliente. El tablero ya tiene todas las tareas cargadas, así que filtrar es instantáneo y los enlaces se pueden compartir. Si un proyecto supera unas ~2k tareas, conviene mover la búsqueda al servidor (índice `pg_trgm` sobre `title`).
- **Modal enlazable** con `?task=<id>`.
- **Seguridad:**
  - Cada handler comprueba la membresía. A los no miembros se les responde 404 para no revelar que el recurso existe.
  - Los IDs de asignados y etiquetas se validan contra el workspace.
  - Los canales de Pusher son privados y se autorizan en `/api/pusher/auth`.
  - El Markdown se renderiza sin HTML crudo, lo que evita XSS.
  - Borrar una tarea requiere ser `ADMIN` o su creador.

## 5. Siguientes pasos (fuera del MVP)

- Webhook de Clerk (`user.updated`) para sincronizar nombre y avatar.
- Pantallas para gestionar workspaces, miembros, invitaciones, columnas y etiquetas (el modelo ya las soporta).
- Vista de Sprint/Backlog usando `Sprint`.
- Edición y borrado de comentarios, menciones `@usuario`.
- Tests: unitarios de `lib/ordering.ts` y `lib/filters.ts`, e integración del endpoint `move` (vecinos válidos, 409, rebalanceo).
