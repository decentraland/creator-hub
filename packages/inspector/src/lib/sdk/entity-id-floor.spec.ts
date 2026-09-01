import { afterEach, describe, expect, it } from 'vitest';

import {
  createFloorEntityContainer,
  getEntityIdFloor,
  parseMaxLiveEntityId,
  resetEntityIdFloor,
  setEntityIdFloor,
} from './entity-id-floor';

const NUMBER = (e: unknown) => (e as number) & 0xffff;

describe('entity-id-floor (#1468)', () => {
  afterEach(() => resetEntityIdFloor());

  it('allocates from the reserved-static base when no floor is set', () => {
    const container = createFloorEntityContainer();
    expect(NUMBER(container.generateEntity())).toBe(512);
  });

  it('allocates above the floor when one is set (skips the code-entity range)', () => {
    setEntityIdFloor(1000);
    const container = createFloorEntityContainer();
    expect(NUMBER(container.generateEntity())).toBeGreaterThanOrEqual(1000);
  });

  it('applies a floor set AFTER the container was created', () => {
    const container = createFloorEntityContainer();
    expect(NUMBER(container.generateEntity())).toBe(512); // no floor yet
    setEntityIdFloor(2000);
    expect(NUMBER(container.generateEntity())).toBeGreaterThanOrEqual(2000);
  });

  it('is monotonic (a smaller reading never lowers the floor) and reset clears it', () => {
    setEntityIdFloor(1000);
    setEntityIdFloor(500);
    expect(getEntityIdFloor()).toBe(1000);
    resetEntityIdFloor();
    expect(getEntityIdFloor()).toBe(0);
  });

  it('refuses an unsatisfiable floor (>= the entity number space) so allocation cannot starve', () => {
    // 65535 is the max entity number; a floor there/above leaves nothing to allocate.
    setEntityIdFloor(65535);
    expect(getEntityIdFloor()).toBe(0);
    const container = createFloorEntityContainer();
    expect(() => container.generateEntity()).not.toThrow();
  });

  it('does not brick allocation when fed a version-bumped (packed) id reading (#1468 regression)', () => {
    // A reloaded scene reports packed ids `number | version<<16`; e.g. number 512 at
    // version 1 = 66048. Naively using that as the floor made generateEntity skip every
    // id until it threw "out of range 65535". Masked, the floor is a real number.
    setEntityIdFloor(parseMaxLiveEntityId('66048') + 1);
    expect(getEntityIdFloor()).toBe(513);
    const container = createFloorEntityContainer();
    expect(() => container.generateEntity()).not.toThrow();
    expect(NUMBER(container.generateEntity())).toBeGreaterThanOrEqual(513);
  });

  it('keeps allocating monotonically once above the floor', () => {
    setEntityIdFloor(1000);
    const container = createFloorEntityContainer();
    const a = NUMBER(container.generateEntity());
    const b = NUMBER(container.generateEntity());
    expect(a).toBeGreaterThanOrEqual(1000);
    expect(b).toBeGreaterThan(a);
  });

  describe('parseMaxLiveEntityId (the /scene_entities → floor wiring)', () => {
    it('takes the max numeric id, ignoring aliases', () => {
      expect(parseMaxLiveEntityId('root\nplayer\n512\ncamera\n518\n513')).toBe(518);
    });
    it('masks the version bits off packed ids and takes the max NUMBER', () => {
      // 66048 = number 512 at version 1; 513 = number 513 at version 0. Max number = 513.
      expect(parseMaxLiveEntityId('66048\n513')).toBe(513);
      expect(parseMaxLiveEntityId('66048')).toBe(512);
    });
    it('returns 0 for "(no entities)" or empty', () => {
      expect(parseMaxLiveEntityId('(no entities)')).toBe(0);
      expect(parseMaxLiveEntityId('')).toBe(0);
    });
    it('handles a single numeric entity', () => {
      expect(parseMaxLiveEntityId('512')).toBe(512);
    });
  });
});
