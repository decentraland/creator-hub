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

/** Drop all entries (canvas teardown / scene switch) so recycled ids never resolve stale elements. */
export function clearNodeRegistry(): void {
  nodeElements.clear();
}
