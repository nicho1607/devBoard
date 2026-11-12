// Indexación fraccional: cada tarea guarda un `position` float y al soltarla
// entre A y B se le asigna el punto medio. Mover una tarea = 1 UPDATE,
// sin renumerar la columna. Si el hueco se vuelve demasiado pequeño
// (tras ~50 inserciones en el mismo sitio) se rebalancea la columna.

export const POSITION_STEP = 1024;
const MIN_GAP = 1e-6;

export function positionBetween(prev: number | null, next: number | null): number {
  if (prev === null && next === null) return POSITION_STEP;
  if (prev === null) return next! - POSITION_STEP;
  if (next === null) return prev + POSITION_STEP;
  return (prev + next) / 2;
}

export function needsRebalance(prev: number | null, next: number | null): boolean {
  return prev !== null && next !== null && next - prev < MIN_GAP;
}

/** Orden estable: position y, en empate (moves concurrentes), id. */
export function comparePosition(
  a: { position: number; id: string },
  b: { position: number; id: string },
) {
  return a.position - b.position || a.id.localeCompare(b.id);
}
