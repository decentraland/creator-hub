export type GroupMove = { top: number; left: number };

type GroupDragState = {
  active: boolean;
  dx: number;
  dy: number;
  entities: Set<number>;
  commit: Map<number, GroupMove> | null;
};

let state: GroupDragState = { active: false, dx: 0, dy: 0, entities: new Set(), commit: null };
const listeners = new Set<() => void>();
const emit = (): void => {
  for (const l of listeners) l();
};

export function subscribeGroupDrag(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function startGroupDrag(entities: number[]): void {
  state = { active: true, dx: 0, dy: 0, entities: new Set(entities), commit: null };
  emit();
}

export function moveGroupDrag(dx: number, dy: number): void {
  if (!state.active) return;
  state = { ...state, dx, dy };
  emit();
}

/** End the live drag and hand each participant its dropped position to hold. */
export function commitGroupDrag(commit: Map<number, GroupMove>): void {
  state = { active: false, dx: 0, dy: 0, entities: state.entities, commit };
  emit();
}

export function clearGroupDrag(): void {
  liveCache.clear();
  state = { active: false, dx: 0, dy: 0, entities: new Set(), commit: null };
  emit();
}

/** Live offset for one participant, or null when it isn't in an active group drag. */
const liveCache = new Map<number, { dx: number; dy: number }>();
export function groupLiveOffsetFor(entity: number): { dx: number; dy: number } | null {
  if (!state.active || !state.entities.has(entity)) {
    liveCache.delete(entity);
    return null;
  }
  const prev = liveCache.get(entity);
  if (prev && prev.dx === state.dx && prev.dy === state.dy) return prev;
  const next = { dx: state.dx, dy: state.dy };
  liveCache.set(entity, next);
  return next;
}

export function groupCommitFor(entity: number): GroupMove | null {
  return state.commit?.get(entity) ?? null;
}

let clickSuppressed = false;
export function armGroupClickSuppression(): void {
  clickSuppressed = true;
}
export function resetGroupClickSuppression(): void {
  clickSuppressed = false;
}
export function consumeGroupClickSuppression(): boolean {
  const was = clickSuppressed;
  clickSuppressed = false;
  return was;
}
