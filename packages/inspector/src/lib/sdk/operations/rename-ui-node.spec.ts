import { describe, expect, it } from 'vitest';
import type { Entity, IEngine } from '@dcl/ecs';

import { renameUINode } from './rename-ui-node';

const NAME_ID = 'core-schema::Name';

type NameValue = { value: string };

interface MockName {
  store: Map<Entity, NameValue>;
  has(entity: Entity): boolean;
  getOrNull(entity: Entity): NameValue | null;
  createOrReplace(entity: Entity, value: NameValue): void;
}

function makeName(initial: Array<[Entity, NameValue]>): MockName {
  const store = new Map(initial);
  return {
    store,
    has: (entity: Entity) => store.has(entity),
    getOrNull: (entity: Entity) => store.get(entity) ?? null,
    createOrReplace: (entity, value) => {
      store.set(entity, value);
    },
  };
}

function makeEngine(name: MockName | null): IEngine {
  return {
    getComponentOrNull: (id: string | number) => (id === NAME_ID ? name : null),
    // The op passes the Name component through, but the mock just streams the store.
    getEntitiesWith: () =>
      name ? (name.store.entries() as Iterable<[Entity, NameValue]>) : ([] as never[]),
  } as unknown as IEngine;
}

describe('renameUINode', () => {
  describe('when renaming to a free name', () => {
    it('writes the requested name verbatim', () => {
      const a = 1 as Entity;
      const name = makeName([[a, { value: 'Old' }]]);
      const op = renameUINode(makeEngine(name));

      expect(op(a, 'Fresh')).toBe('Fresh');
      expect(name.store.get(a)).toEqual({ value: 'Fresh' });
    });
  });

  describe('when the requested name is already used by another entity', () => {
    it('appends the smallest free _N suffix', () => {
      const a = 1 as Entity;
      const b = 2 as Entity;
      const name = makeName([
        [a, { value: 'Foo' }],
        [b, { value: 'Label' }],
      ]);
      const op = renameUINode(makeEngine(name));

      expect(op(a, 'Label')).toBe('Label_1');
      expect(name.store.get(a)).toEqual({ value: 'Label_1' });
    });

    it('skips already-taken suffixes to the next free one', () => {
      const a = 1 as Entity;
      const b = 2 as Entity;
      const c = 3 as Entity;
      const name = makeName([
        [a, { value: 'Foo' }],
        [b, { value: 'Label' }],
        [c, { value: 'Label_1' }],
      ]);
      const op = renameUINode(makeEngine(name));

      expect(op(a, 'Label')).toBe('Label_2');
      expect(name.store.get(a)).toEqual({ value: 'Label_2' });
    });
  });

  describe('when renaming an entity to its own current name', () => {
    it('keeps the name unchanged (self is excluded from the taken set)', () => {
      const a = 1 as Entity;
      const name = makeName([[a, { value: 'Label' }]]);
      const op = renameUINode(makeEngine(name));

      expect(op(a, 'Label')).toBe('Label');
      expect(name.store.get(a)).toEqual({ value: 'Label' });
    });
  });

  describe('when the requested name is empty or whitespace', () => {
    it('is a no-op and returns null', () => {
      const a = 1 as Entity;
      const name = makeName([[a, { value: 'Label' }]]);
      const op = renameUINode(makeEngine(name));

      expect(op(a, '')).toBeNull();
      expect(op(a, '   ')).toBeNull();
      expect(name.store.get(a)).toEqual({ value: 'Label' });
    });
  });

  describe('when the entity has no Name component', () => {
    it('returns null (entity not in the Name store)', () => {
      const a = 1 as Entity;
      const b = 2 as Entity;
      const name = makeName([[a, { value: 'Label' }]]);
      const op = renameUINode(makeEngine(name));

      expect(op(b, 'Anything')).toBeNull();
      expect(name.store.has(b)).toBe(false);
    });

    it('returns null when the Name component is not registered', () => {
      const op = renameUINode(makeEngine(null));
      expect(op(1 as Entity, 'Anything')).toBeNull();
    });
  });

  describe('when the requested name already carries a free numeric suffix', () => {
    it('keeps it as-is (idempotent suffix handling)', () => {
      const a = 1 as Entity;
      const name = makeName([[a, { value: 'Old' }]]);
      const op = renameUINode(makeEngine(name));

      expect(op(a, 'Label_2')).toBe('Label_2');
      expect(name.store.get(a)).toEqual({ value: 'Label_2' });
    });
  });
});
