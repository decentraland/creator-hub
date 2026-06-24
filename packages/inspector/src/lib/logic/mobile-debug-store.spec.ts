import { beforeEach, describe, expect, it } from 'vitest';
import * as store from './mobile-debug-store';

function crdt(
  op: 'p' | 'd' | 'de' | 'a',
  e: number,
  c: string,
  payload?: unknown,
  extras: Partial<{ sid: number; tk: number }> = {},
): Record<string, unknown> {
  return {
    type: 'crdt',
    sid: extras.sid ?? 1,
    tk: extras.tk ?? 0,
    t: 0,
    d: 's2r',
    e,
    c,
    op,
    ct: 0,
    l: 0,
    payload,
  };
}

describe('mobile-debug-store.pushEntries', () => {
  beforeEach(() => store.reset());

  describe('when receiving a put crdt entry', () => {
    it('creates the entity with the component value', () => {
      store.pushEntries([crdt('p', 42, 'Transform', { x: 1 })]);
      const entities = store.getSnapshot().entities;
      expect(entities[42]).toEqual({
        components: { Transform: { x: 1 } },
        parent: 0,
      });
    });

    it('bumps the snapshot reference so useSyncExternalStore fires', () => {
      const before = store.getSnapshot().entities;
      store.pushEntries([crdt('p', 1, 'X', {})]);
      const after = store.getSnapshot().entities;
      expect(after).not.toBe(before);
    });

    it('does not mutate the previous snapshot', () => {
      store.pushEntries([crdt('p', 7, 'Transform', { v: 1 })]);
      const frozen = store.getSnapshot().entities;
      const prior = frozen[7];
      store.pushEntries([crdt('p', 7, 'Transform', { v: 2 })]);
      expect(prior.components.Transform).toEqual({ v: 1 });
      expect(store.getSnapshot().entities[7].components.Transform).toEqual({ v: 2 });
    });
  });

  describe('when receiving a delete-entity op', () => {
    it('removes the entity from the snapshot', () => {
      store.pushEntries([crdt('p', 10, 'A', {}), crdt('de', 10, '')]);
      expect(store.getSnapshot().entities[10]).toBeUndefined();
    });
  });

  describe('when receiving an append-op-stream op', () => {
    it('appends payloads into an array component', () => {
      store.pushEntries([crdt('a', 5, 'Events', { v: 1 }), crdt('a', 5, 'Events', { v: 2 })]);
      expect(store.getSnapshot().entities[5].components.Events).toEqual([{ v: 1 }, { v: 2 }]);
    });

    it('does not mutate the previous snapshot array', () => {
      store.pushEntries([crdt('a', 5, 'Events', { v: 1 })]);
      const priorArr = store.getSnapshot().entities[5].components.Events as unknown[];
      expect(priorArr).toEqual([{ v: 1 }]);
      store.pushEntries([crdt('a', 5, 'Events', { v: 2 })]);
      expect(priorArr).toEqual([{ v: 1 }]);
      expect(store.getSnapshot().entities[5].components.Events).toEqual([{ v: 1 }, { v: 2 }]);
    });
  });

  describe('when a component key is __proto__ / constructor / prototype', () => {
    it('drops the entry instead of polluting the prototype chain', () => {
      store.pushEntries([
        crdt('p', 1, '__proto__', { polluted: true }),
        crdt('p', 1, 'constructor', { polluted: true }),
        crdt('p', 1, 'prototype', { polluted: true }),
      ]);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      // applyToState rejects the pollution keys so no components leak through.
      expect(store.getSnapshot().entities[1]?.components).toEqual({});
    });
  });

  describe('when a crdt entry has a missing or mistyped field', () => {
    it('skips the entry without crashing', () => {
      store.pushEntries([
        { type: 'crdt' },
        { type: 'crdt', sid: '1', tk: 0, e: 1, c: 'X', op: 'p' },
        { type: 'crdt', sid: 1, tk: 0, e: 1, c: null, op: 'p' },
      ]);
      expect(Object.keys(store.getSnapshot().entities)).toHaveLength(0);
    });
  });

  describe('reconstructStateAtTick', () => {
    it('replays CRDT ops up to targetTick for the given scene', () => {
      store.pushEntries([
        crdt('p', 1, 'Transform', { v: 1 }, { tk: 1, sid: 10 }),
        crdt('p', 1, 'Transform', { v: 2 }, { tk: 2, sid: 10 }),
        crdt('p', 1, 'Transform', { v: 3 }, { tk: 3, sid: 10 }),
        crdt('p', 1, 'Transform', { v: 99 }, { tk: 1, sid: 20 }),
      ]);
      const result = store.reconstructStateAtTick(2, 10);
      expect(result.state[1].components.Transform).toEqual({ v: 2 });
      expect(result.truncated).toBe(false);
    });

    it('flags truncated when targetTick predates the buffer', () => {
      store.pushEntries([crdt('p', 1, 'Transform', {}, { tk: 5, sid: 1 })]);
      const result = store.reconstructStateAtTick(0, 1);
      expect(result.truncated).toBe(true);
      expect(result.oldestAvailableTick).toBe(5);
    });

    it('reports not truncated when targetTick is in range', () => {
      store.pushEntries([
        crdt('p', 1, 'Transform', { v: 1 }, { tk: 5, sid: 1 }),
        crdt('p', 1, 'Transform', { v: 2 }, { tk: 10, sid: 1 }),
      ]);
      const result = store.reconstructStateAtTick(10, 1);
      expect(result.truncated).toBe(false);
      expect(result.oldestAvailableTick).toBe(5);
    });
  });

  describe('when receiving a perf entry', () => {
    it('does not alias perfHistory across snapshots', () => {
      store.pushEntries([{ type: 'perf', fps: 60 }]);
      const prior = store.getSnapshot().perfHistory;
      store.pushEntries([{ type: 'perf', fps: 30 }]);
      const next = store.getSnapshot().perfHistory;
      expect(prior).not.toBe(next);
      expect(prior).toHaveLength(1);
      expect(next).toHaveLength(2);
      expect(prior[0].fps).toBe(60);
    });
  });

  describe('clear()', () => {
    it('resets the last-update timestamp so the highlight RAF stops ticking', () => {
      store.pushEntries([crdt('p', 1, 'Transform', {})]);
      expect(store.getLastAnyUpdateTime()).toBeGreaterThan(0);
      store.clear();
      expect(store.getLastAnyUpdateTime()).toBe(0);
    });
  });
});
