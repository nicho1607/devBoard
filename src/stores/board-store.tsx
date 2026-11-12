"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createStore, useStore, type StoreApi } from "zustand";
import type { BoardColumn, BoardData, BoardTask, LabelDTO, MemberDTO } from "@/types/board";

type BoardState = {
  projectId: string;
  projectKey: string;
  columns: BoardColumn[];
  tasks: Record<string, BoardTask>;
  members: MemberDTO[];
  labels: LabelDTO[];
  currentUserId: string;

  hydrate: (data: BoardData) => void;
  upsertTask: (task: BoardTask) => void;
  removeTask: (taskId: string) => void;
  moveTask: (taskId: string, columnId: string, position: number) => void;
  applyPositions: (positions: { id: string; position: number }[]) => void;
};

export type BoardInit = BoardData & {
  projectKey: string;
  members: MemberDTO[];
  labels: LabelDTO[];
  currentUserId: string;
};

const indexTasks = (tasks: BoardTask[]) => Object.fromEntries(tasks.map((t) => [t.id, t]));

function createBoardStore(init: BoardInit) {
  return createStore<BoardState>()((set) => ({
    ...init,
    tasks: indexTasks(init.tasks),

    hydrate: (data) => set({ columns: data.columns, tasks: indexTasks(data.tasks) }),

    // Ignora eventos más antiguos que lo que ya tenemos (llegadas fuera de orden).
    upsertTask: (task) =>
      set((s) => {
        const current = s.tasks[task.id];
        if (current && current.updatedAt > task.updatedAt) return s;
        return { tasks: { ...s.tasks, [task.id]: task } };
      }),

    removeTask: (taskId) =>
      set((s) => {
        const { [taskId]: _removed, ...rest } = s.tasks;
        return { tasks: rest };
      }),

    moveTask: (taskId, columnId, position) =>
      set((s) => {
        const task = s.tasks[taskId];
        if (!task) return s;
        return { tasks: { ...s.tasks, [taskId]: { ...task, columnId, position } } };
      }),

    applyPositions: (positions) =>
      set((s) => {
        const tasks = { ...s.tasks };
        for (const { id, position } of positions) {
          if (tasks[id]) tasks[id] = { ...tasks[id], position };
        }
        return { tasks };
      }),
  }));
}

const BoardStoreContext = createContext<StoreApi<BoardState> | null>(null);

/**
 * Store por tablero (patrón recomendado por zustand para Next.js: nada de
 * singletons compartidos entre requests). Se re-hidrata cuando el Server
 * Component entrega datos nuevos (p. ej. tras router.refresh()).
 */
export function BoardStoreProvider({ init, children }: { init: BoardInit; children: ReactNode }) {
  const [store] = useState(() => createBoardStore(init));

  useEffect(() => {
    store.getState().hydrate(init);
    store.setState({ members: init.members, labels: init.labels });
  }, [init, store]);

  return <BoardStoreContext.Provider value={store}>{children}</BoardStoreContext.Provider>;
}

export function useBoardStore<T>(selector: (state: BoardState) => T): T {
  const store = useContext(BoardStoreContext);
  if (!store) throw new Error("useBoardStore debe usarse dentro de <BoardStoreProvider>");
  return useStore(store, selector);
}

export function useBoardStoreApi() {
  const store = useContext(BoardStoreContext);
  if (!store) throw new Error("useBoardStoreApi debe usarse dentro de <BoardStoreProvider>");
  return store;
}
