import { describe, expect, it } from 'vitest';
import type { Entity, IEngine } from '@dcl/ecs';

import { setUIParent } from './set-ui-parent';

interface MockUiTransform {
  store: Map<Entity, { parent?: number; rightOf?: number }>;
  has(entity: Entity): boolean;
  getOrNull(entity: Entity): { parent?: number; rightOf?: number } | null;
  createOrReplace(entity: Entity, value: { parent?: number; rightOf?: number }): void;
}

function makeUiTransform(
  initial: Array<[Entity, { parent?: number; rightOf?: number }]>,
): MockUiTransform {
  const store = new Map(initial);
  return {
    store,
    has: (entity: Entity) => store.has(entity),
    getOrNull: (entity: Entity) => store.get(entity) ?? null,
    createOrReplace: (entity: Entity, value) => {
      store.set(entity, value);
    },
  };
}

function makeEngine(uiTransform: MockUiTransform | null): IEngine {
  return {
    getComponentOrNull: (id: string | number) => (id === 'core::UiTransform' ? uiTransform : null),
  } as unknown as IEngine;
}

describe('setUIParent', () => {
  describe('when child and newParent are the same entity', () => {
    it('returns false without mutating the component', () => {
      const a = 1 as Entity;
      const uiTransform = makeUiTransform([[a, { parent: 0 }]]);
      const engine = makeEngine(uiTransform);
      const op = setUIParent(engine);

      expect(op(a, a)).toBe(false);
      expect(uiTransform.store.get(a)).toEqual({ parent: 0 });
    });
  });

  describe('when reparenting a grandparent under its own leaf descendant', () => {
    it('detects the cycle, returns false, and leaves the tree intact', () => {
      // grandparent (10) -> parent (11) -> leaf (12)
      const grandparent = 10 as Entity;
      const parent = 11 as Entity;
      const leaf = 12 as Entity;

      const uiTransform = makeUiTransform([
        [grandparent, { parent: 0 }],
        [parent, { parent: grandparent as unknown as number }],
        [leaf, { parent: parent as unknown as number }],
      ]);
      const engine = makeEngine(uiTransform);
      const op = setUIParent(engine);

      expect(op(grandparent, leaf)).toBe(false);

      // No mutation — grandparent still parents nothing, leaf still parented by parent.
      expect(uiTransform.store.get(grandparent)?.parent).toBe(0);
      expect(uiTransform.store.get(parent)?.parent).toBe(grandparent as unknown as number);
      expect(uiTransform.store.get(leaf)?.parent).toBe(parent as unknown as number);
    });
  });

  describe('when reparenting a leaf under an unrelated entity', () => {
    it('returns true and writes the new parent', () => {
      const root = 1 as Entity;
      const sibling = 2 as Entity;
      const leaf = 3 as Entity;

      const uiTransform = makeUiTransform([
        [root, { parent: 0 }],
        [sibling, { parent: root as unknown as number }],
        [leaf, { parent: root as unknown as number }],
      ]);
      const engine = makeEngine(uiTransform);
      const op = setUIParent(engine);

      expect(op(leaf, sibling)).toBe(true);
      expect(uiTransform.store.get(leaf)?.parent).toBe(sibling as unknown as number);
    });
  });

  describe('when the UiTransform component is not registered', () => {
    it('returns false', () => {
      const engine = makeEngine(null);
      const op = setUIParent(engine);
      expect(op(1 as Entity, 2 as Entity)).toBe(false);
    });
  });

  describe('when the child entity lacks a UiTransform', () => {
    it('returns false', () => {
      const child = 1 as Entity;
      const parent = 2 as Entity;
      const uiTransform = makeUiTransform([[parent, { parent: 0 }]]);
      const engine = makeEngine(uiTransform);
      const op = setUIParent(engine);
      expect(op(child, parent)).toBe(false);
    });
  });
});
