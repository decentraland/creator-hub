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
