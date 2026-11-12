import { PROJECT_CHANNEL_RE } from "@/lib/realtime/events";
import { pusherServer } from "@/lib/realtime/server";
import { requireProjectAccess } from "@/server/auth";
import { HttpError, route } from "@/server/http";

/**
 * POST /api/pusher/auth — autoriza la suscripción a `private-project-{id}`.
 * Sin esto cualquiera con la key pública podría escuchar cualquier tablero.
 */
export const POST = route(async (req) => {
  const form = await req.formData();
  const socketId = String(form.get("socket_id") ?? "");
  const channel = String(form.get("channel_name") ?? "");

  const projectId = PROJECT_CHANNEL_RE.exec(channel)?.[1];
  if (!socketId || !projectId) throw new HttpError(403, "Canal no permitido");

  await requireProjectAccess(projectId);
  return Response.json(pusherServer.authorizeChannel(socketId, channel));
});
