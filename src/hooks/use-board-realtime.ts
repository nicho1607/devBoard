"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getPusherClient } from "@/lib/realtime/client";
import { projectChannel, type BoardEvent } from "@/lib/realtime/events";
import { useBoardStoreApi } from "@/stores/board-store";

/**
 * Suscribe el tablero al canal del proyecto y aplica los eventos al store.
 * Si la conexión se cae, al reconectar pedimos al servidor el estado
 * completo (router.refresh) porque pudimos perder eventos mientras tanto.
 */
export function useBoardRealtime(projectId: string) {
  const store = useBoardStoreApi();
  const router = useRouter();

  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(projectChannel(projectId));
    const { upsertTask, removeTask, applyPositions } = store.getState();

    const onUpsert = (e: Extract<BoardEvent, { type: "task:upserted" }>) => upsertTask(e.task);
    const onMoved = (e: Extract<BoardEvent, { type: "task:moved" }>) => {
      if (e.rebalanced) applyPositions(e.rebalanced);
      upsertTask(e.task);
    };
    const onDeleted = (e: Extract<BoardEvent, { type: "task:deleted" }>) => removeTask(e.taskId);

    channel.bind("task:upserted", onUpsert);
    channel.bind("task:moved", onMoved);
    channel.bind("task:deleted", onDeleted);

    let wasDisconnected = false;
    const onStateChange = ({ current }: { current: string }) => {
      if (current === "unavailable" || current === "disconnected") wasDisconnected = true;
      if (current === "connected" && wasDisconnected) {
        wasDisconnected = false;
        router.refresh();
      }
    };
    pusher.connection.bind("state_change", onStateChange);

    return () => {
      channel.unbind("task:upserted", onUpsert);
      channel.unbind("task:moved", onMoved);
      channel.unbind("task:deleted", onDeleted);
      pusher.connection.unbind("state_change", onStateChange);
      pusher.unsubscribe(projectChannel(projectId));
    };
  }, [projectId, store, router]);
}
