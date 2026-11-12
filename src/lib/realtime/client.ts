"use client";

import PusherClient from "pusher-js";

let client: PusherClient | null = null;

export function getPusherClient() {
  if (!client) {
    client = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      channelAuthorization: { endpoint: "/api/pusher/auth", transport: "ajax" },
    });
  }
  return client;
}

/** socket_id actual, para que el servidor no nos reenvíe nuestros propios cambios. */
export function currentSocketId(): string | undefined {
  return client?.connection.socket_id ?? undefined;
}
