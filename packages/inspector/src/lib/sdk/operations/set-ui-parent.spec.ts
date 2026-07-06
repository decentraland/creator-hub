import { describe, expect, it } from 'vitest';
import type { Entity, IEngine } from '@dcl/ecs';

import { YGPT_ABSOLUTE, YGPT_RELATIVE, YGU_POINT, YGU_UNDEFINED } from '../ui-transform-constants';
import { setUIParent } from './set-ui-parent';

type UiTransformValue = {
  parent?: number;
  rightOf?: number;
  positionType?: number;
  positionTop?: number;
  positionTopUnit?: number;
  positionLeft?: number;
  positionLeftUnit?: number;
  positionRight?: number;
  positionRightUnit?: number;
  positionBottom?: number;
  positionBottomUnit?: number;
};

interface MockUiTransform {
  store: Map<Entity, UiTransformValue>;
  has(entity: Entity): boolean;
  getOrNull(entity: Entity): UiTransformValue | null;
  createOrReplace(entity: Entity, value: UiTransformValue): void;
}

function makeUiTransform(initial: Array<[Entity, UiTransformValue]>): MockUiTransform {
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

  describe('when reparenting with a position override', () => {
    const root = 1 as Entity;
    const oldParent = 2 as Entity;
    const newParent = 3 as Entity;
    const child = 4 as Entity;

    it('rebases an absolute child onto the new parent and clears right/bottom', () => {
      const uiTransform = makeUiTransform([
        [root, { parent: 0 }],
        [oldParent, { parent: root as unknown as number }],
        [newParent, { parent: root as unknown as number }],
        [
          child,
          {
            parent: oldParent as unknown as number,
            positionType: YGPT_ABSOLUTE,
            positionTop: 100,
            positionTopUnit: YGU_POINT,
            positionLeft: 200,
            positionLeftUnit: YGU_POINT,
            rightOf: 99,
          },
        ],
      ]);
      const op = setUIParent(makeEngine(uiTransform));

      expect(op(child, newParent, { position: { top: 10, left: 20 } })).toBe(true);

      const written = uiTransform.store.get(child)!;
      expect(written.parent).toBe(newParent as unknown as number);
      expect(written.positionTop).toBe(10);
      expect(written.positionLeft).toBe(20);
      expect(written.positionTopUnit).toBe(YGU_POINT);
      expect(written.positionLeftUnit).toBe(YGU_POINT);
      expect(written.positionRight).toBe(0);
      expect(written.positionRightUnit).toBe(YGU_UNDEFINED);
      expect(written.positionBottom).toBe(0);
      expect(written.positionBottomUnit).toBe(YGU_UNDEFINED);
      expect(written.rightOf).toBe(0);
    });

    it('ignores the override for an in-flow (relative) child', () => {
      const uiTransform = makeUiTransform([
        [root, { parent: 0 }],
        [oldParent, { parent: root as unknown as number }],
        [newParent, { parent: root as unknown as number }],
        [
          child,
          {
            parent: oldParent as unknown as number,
            positionType: YGPT_RELATIVE,
            positionTop: 100,
            positionTopUnit: YGU_POINT,
            positionLeft: 200,
            positionLeftUnit: YGU_POINT,
          },
        ],
      ]);
      const op = setUIParent(makeEngine(uiTransform));

      expect(op(child, newParent, { position: { top: 10, left: 20 } })).toBe(true);

      const written = uiTransform.store.get(child)!;
      expect(written.parent).toBe(newParent as unknown as number);
      // Override ignored — offsets unchanged from the original.
      expect(written.positionTop).toBe(100);
      expect(written.positionLeft).toBe(200);
    });

    it('leaves position fields unchanged for an absolute child with no override', () => {
      const uiTransform = makeUiTransform([
        [root, { parent: 0 }],
        [oldParent, { parent: root as unknown as number }],
        [newParent, { parent: root as unknown as number }],
        [
          child,
          {
            parent: oldParent as unknown as number,
            positionType: YGPT_ABSOLUTE,
            positionTop: 100,
            positionTopUnit: YGU_POINT,
            positionLeft: 200,
            positionLeftUnit: YGU_POINT,
          },
        ],
      ]);
      const op = setUIParent(makeEngine(uiTransform));

      expect(op(child, newParent)).toBe(true);

      const written = uiTransform.store.get(child)!;
      expect(written.parent).toBe(newParent as unknown as number);
      expect(written.positionTop).toBe(100);
      expect(written.positionLeft).toBe(200);
      // Right/bottom were never present and stay absent (no positionPatch applied).
      expect(written.positionRight).toBeUndefined();
      expect(written.positionBottom).toBeUndefined();
    });

    it('never rewrites a descendant of the moved node', () => {
      // root(1) -> moved(2) -> leaf(4); sibling(3) is the new parent.
      const moved = 2 as Entity;
      const sibling = 3 as Entity;
      const leaf = 4 as Entity;
      const leafValue: UiTransformValue = {
        parent: moved as unknown as number,
        positionType: YGPT_ABSOLUTE,
        positionTop: 5,
        positionTopUnit: YGU_POINT,
        positionLeft: 7,
        positionLeftUnit: YGU_POINT,
      };
      const uiTransform = makeUiTransform([
        [root, { parent: 0 }],
        [moved, { parent: root as unknown as number, positionType: YGPT_ABSOLUTE }],
        [sibling, { parent: root as unknown as number }],
        [leaf, { ...leafValue }],
      ]);
      const before = structuredClone(leafValue);
      const op = setUIParent(makeEngine(uiTransform));

      expect(op(moved, sibling, { position: { top: 10, left: 20 } })).toBe(true);

      // The moved node's descendant is byte-identical — no path rewrites children.
      expect(uiTransform.store.get(leaf)).toEqual(before);
    });
  });
});
