# DevBoard

Tablero Kanban colaborativo en tiempo real para equipos de desarrollo. Stack: Next.js 15, Prisma/PostgreSQL, Clerk, Pusher y shadcn/ui.

Arquitectura, modelo de datos y flujo de tiempo real: [ARCHITECTURE.md](ARCHITECTURE.md).

## Puesta en marcha

1. `npm install`
2. Copia `.env.example` a `.env` y rellena:
   - `DATABASE_URL`: cualquier PostgreSQL (local, Neon, Supabase…).
   - Claves de Clerk: crea una app y activa **GitHub** en *SSO connections*.
   - Claves de Pusher Channels: crea una app.
   - `SEED_ADMIN_EMAIL`: el email con el que harás login.
3. `npm run db:migrate -- --name init`
4. `npm run db:seed`
5. `npm run dev` → inicia sesión con ese email → abre `/w/acme/p/DEV`.

Para probar el tiempo real, abre el tablero en dos navegadores y mueve una tarjeta.
