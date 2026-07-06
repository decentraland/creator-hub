import { describe, expect, it } from 'vitest';
import type { Entity, IEngine } from '@dcl/ecs';

import { orderSiblings, type ComponentBag } from '../../../components/UIDesigner/tree-model';
import { reorderUISibling } from './reorder-ui-sibling';

type UiTransformValue = {
  parent?: number;
  rightOf?: number;
  positionTop?: number;
  positionTopUnit?: number;
  width?: number;
  widthUnit?: number;
};

interface MockUiTransform {
  store: Map<Entity, UiTransformValue>;
  has(entity: Entity): boolean;
  getOrNull(entity: Entity): UiTransformValue | null;
  createOrReplace(entity: Entity, value: UiTransformValue): void;
  iterator(): IterableIterator<[Entity, UiTransformValue]>;
}

function makeUiTransform(initial: Array<[Entity, UiTransformValue]>): MockUiTransform {
  const store = new Map<Entity, UiTransformValue>(initial);
  return {
    store,
    has: (entity: Entity) => store.has(entity),
    getOrNull: (entity: Entity) => store.get(entity) ?? null,
    createOrReplace: (entity: Entity, value) => {
      store.set(entity, value);
    },
    iterator: () => store.entries(),
  };
}

function makeEngine(uiTransform: MockUiTransform | null): IEngine {
  return {
    getComponentOrNull: (id: string | number) => (id === 'core::UiTransform' ? uiTransform : null),
    // Mirrors engine.getEntitiesWith(component): yields [entity, value] for
    // every entity carrying the component (reorderUISibling iterates this way).
    getEntitiesWith: () => (uiTransform ? uiTransform.iterator() : [][Symbol.iterator]()),
  } as unknown as IEngine;
}

// A ComponentBag whose UiTransform is the mock — orderSiblings only reads
// `bag.UiTransform.getOrNull(...).rightOf`, so the rest can stay absent.
function makeBag(uiTransform: MockUiTransform): ComponentBag {
  return { UiTransform: uiTransform } as unknown as ComponentBag;
}

// Strip `rightOf` so we can assert the rest of a UiTransform is byte-identical.
function withoutRightOf(v: UiTransformValue | null): UiTransformValue {
  const { rightOf: _rightOf, ...rest } = v ?? {};
  return rest;
}

const parent = 1 as Entity;
const A = 2 as Entity;
const B = 3 as Entity;
const C = 4 as Entity;

describe('reorderUISibling', () => {
  describe('when moving the last of three head-tied siblings up one slot', () => {
    it('links child after the anchor and resolves order A, C, B', () => {
      // A, B, C created in that order, all rightOf 0 (a legacy all-zero chain).
      const uiTransform = makeUiTransform([
        [parent, { parent: 0 }],
        [A, { parent: 1, rightOf: 0, positionTop: 10, positionTopUnit: 1 }],
        [B, { parent: 1, rightOf: 0, positionTop: 20, positionTopUnit: 1 }],
        [C, { parent: 1, rightOf: 0, positionTop: 30, positionTopUnit: 1 }],
      ]);
      const op = reorderUISibling(makeEngine(uiTransform));

      expect(op(C, A)).toBe(true);

      // C now follows A. In an all-zero chain nobody literally pointed at the
      // anchor, so B keeps rightOf 0 (head) — the orderSiblings DFS still slots
      // C between A and B because A is visited before B and pulls C in as its
      // follower.
      expect(uiTransform.store.get(C)?.rightOf).toBe(A as unknown as number);
      const ordered = orderSiblings([A, B, C], makeBag(uiTransform));
      expect(ordered).toEqual([A, C, B]);
    });
  });

  describe('when moving the head of a clean chain to the end', () => {
    it("repoints child's old follower to the head slot and links child last", () => {
      // Clean chain: A (head) <- B <- C, i.e. B.rightOf=A, C.rightOf=B.
      const uiTransform = makeUiTransform([
        [parent, { parent: 0 }],
        [A, { parent: 1, rightOf: 0 }],
        [B, { parent: 1, rightOf: A as unknown as number }],
        [C, { parent: 1, rightOf: B as unknown as number }],
      ]);
      const op = reorderUISibling(makeEngine(uiTransform));

      expect(op(A, C)).toBe(true);

      // A's old follower B is repointed to A's old rightOf (0 = head); C stays
      // on B; A now follows C.
      expect(uiTransform.store.get(B)?.rightOf).toBe(0);
      expect(uiTransform.store.get(C)?.rightOf).toBe(B as unknown as number);
      expect(uiTransform.store.get(A)?.rightOf).toBe(C as unknown as number);
      const ordered = orderSiblings([A, B, C], makeBag(uiTransform));
      expect(ordered).toEqual([B, C, A]);
    });
  });

  describe('when the anchor sibling has a different parent', () => {
    it('returns false and writes nothing', () => {
      const other = 5 as Entity;
      const uiTransform = makeUiTransform([
        [parent, { parent: 0 }],
        [A, { parent: 1, rightOf: 0 }],
        [C, { parent: 1, rightOf: 0 }],
        [other, { parent: 99, rightOf: 0 }],
      ]);
      const op = reorderUISibling(makeEngine(uiTransform));

      expect(op(C, other)).toBe(false);
      expect(uiTransform.store.get(C)?.rightOf).toBe(0);
      expect(uiTransform.store.get(other)?.rightOf).toBe(0);
    });
  });

  describe('when the anchor is the child itself', () => {
    it('returns false', () => {
      const uiTransform = makeUiTransform([
        [parent, { parent: 0 }],
        [A, { parent: 1, rightOf: 0 }],
      ]);
      const op = reorderUISibling(makeEngine(uiTransform));

      expect(op(A, A)).toBe(false);
    });
  });

  describe('when the UiTransform component is not registered', () => {
    it('returns false', () => {
      const op = reorderUISibling(makeEngine(null));
      expect(op(A, B)).toBe(false);
    });
  });

  describe('when reordering', () => {
    it('never writes any non-rightOf UiTransform field', () => {
      const aValue: UiTransformValue = {
        parent: 1,
        rightOf: 0,
        positionTop: 10,
        positionTopUnit: 1,
        width: 100,
        widthUnit: 1,
      };
      const bValue: UiTransformValue = {
        parent: 1,
        rightOf: A as unknown as number,
        positionTop: 20,
        positionTopUnit: 1,
      };
      const cValue: UiTransformValue = {
        parent: 1,
        rightOf: B as unknown as number,
        positionTop: 30,
        positionTopUnit: 1,
      };
      const uiTransform = makeUiTransform([
        [parent, { parent: 0 }],
        [A, { ...aValue }],
        [B, { ...bValue }],
        [C, { ...cValue }],
      ]);
      const op = reorderUISibling(makeEngine(uiTransform));

      expect(op(A, C)).toBe(true);

      // Every sibling's non-rightOf fields are byte-identical before/after.
      expect(withoutRightOf(uiTransform.store.get(A) ?? null)).toEqual(withoutRightOf(aValue));
      expect(withoutRightOf(uiTransform.store.get(B) ?? null)).toEqual(withoutRightOf(bValue));
      expect(withoutRightOf(uiTransform.store.get(C) ?? null)).toEqual(withoutRightOf(cValue));
    });
  });
});

describe('orderSiblings', () => {
  describe('when the chain is a legacy all-zero list', () => {
    it('keeps creation order', () => {
      const uiTransform = makeUiTransform([
        [A, { parent: 1, rightOf: 0 }],
        [B, { parent: 1, rightOf: 0 }],
        [C, { parent: 1, rightOf: 0 }],
      ]);
      expect(orderSiblings([A, B, C], makeBag(uiTransform))).toEqual([A, B, C]);
    });
  });

  describe('when two siblings form a rightOf cycle', () => {
    it('still returns both entities (defensive cycle handling)', () => {
      const uiTransform = makeUiTransform([
        [A, { parent: 1, rightOf: B as unknown as number }],
        [B, { parent: 1, rightOf: A as unknown as number }],
      ]);
      const ordered = orderSiblings([A, B], makeBag(uiTransform));
      expect(ordered).toHaveLength(2);
      expect(new Set(ordered)).toEqual(new Set([A, B]));
    });
  });
});
