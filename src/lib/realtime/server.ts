import "server-only";
import Pusher from "pusher";
import { projectChannel, type BoardEvent } from "./events";

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

/**
 * Emite un evento al canal del proyecto. `socketId` excluye al emisor,
 * que ya aplicó el cambio de forma optimista.
 * Un fallo de Pusher nunca debe tumbar la mutación ya persistida.
 */
export async function broadcast(projectId: string, event: BoardEvent, socketId?: string) {
  try {
    await pusherServer.trigger(
      projectChannel(projectId),
      event.type,
      event,
      socketId ? { socket_id: socketId } : undefined,
    );
  } catch (err) {
    console.error("[realtime] broadcast failed", event.type, err);
  }
}
