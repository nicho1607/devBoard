"use client";

import { currentSocketId } from "@/lib/realtime/client";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** fetch JSON que adjunta el socket_id de Pusher y normaliza errores. */
export async function api<T>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const socketId = currentSocketId();
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(socketId && { "x-socket-id": socketId }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.error ?? "Error de red");
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
