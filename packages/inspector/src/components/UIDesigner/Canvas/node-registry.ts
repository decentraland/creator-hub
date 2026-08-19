// Maps a UI node's Entity id to its rendered canvas element, so measurement
// code can look up DOM boxes without building DOM-attribute selectors.
import type { Entity } from '@dcl/ecs';

const nodeElements = new Map<number, HTMLElement>();

export function registerNodeElement(entity: Entity, el: HTMLElement): void {
  nodeElements.set(Number(entity), el);
}

export function unregisterNodeElement(entity: Entity): void {
  nodeElements.delete(Number(entity));
}

export function getNodeElement(entity: Entity): HTMLElement | undefined {
  return nodeElements.get(Number(entity));
}

// Drop all entries (e.g. on canvas teardown / scene switch) so recycled entity
// ids never resolve to a detached element from a previous scene.
export function clearNodeRegistry(): void {
  nodeElements.clear();
}
