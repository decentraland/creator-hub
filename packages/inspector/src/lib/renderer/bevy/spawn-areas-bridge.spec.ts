import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BevySceneContext } from './BevySceneContext';
import { createSpawnAreasBridge, toSpawnAreas } from './spawn-areas-bridge';

/**
 * toSpawnAreas maps the Scene metadata's spawn points to drawable boxes: each
 * axis is a single value (a point → 0 half-extent) or a range (an area → half the
 * span), centered at the midpoint. Multiple points → multiple areas (#1374).
 */
describe('toSpawnAreas', () => {
  it('returns [] for no spawn points', () => {
    expect(toSpawnAreas(undefined)).toEqual([]);
    expect(toSpawnAreas([])).toEqual([]);
  });

  it('maps a single-value (point) spawn to a zero-extent box at its position', () => {
    const areas = toSpawnAreas([
      {
        name: 'p',
        default: true,
        position: {
          x: { $case: 'single', value: 8 },
          y: { $case: 'single', value: 0 },
          z: { $case: 'single', value: 12 },
        },
      },
    ]);
    expect(areas).toEqual([
      { center: { x: 8, y: 0, z: 12 }, halfExtents: { x: 0, z: 0 }, isDefault: true },
    ]);
  });

  it('maps a ranged spawn to a box centered at the midpoint with half-span extents', () => {
    const areas = toSpawnAreas([
      {
        name: 'area',
        position: {
          x: { $case: 'range', value: [4, 12] }, // center 8, half-extent 4
          y: { $case: 'single', value: 0 },
          z: { $case: 'range', value: [10, 14] }, // center 12, half-extent 2
        },
      },
    ]);
    expect(areas).toEqual([
      { center: { x: 8, y: 0, z: 12 }, halfExtents: { x: 4, z: 2 }, isDefault: false },
    ]);
  });

  it('maps multiple spawn points to multiple areas', () => {
    const areas = toSpawnAreas([
      {
        name: 'a',
        default: true,
        position: {
          x: { $case: 'single', value: 2 },
          y: { $case: 'single', value: 0 },
          z: { $case: 'single', value: 2 },
        },
      },
      {
        name: 'b',
        position: {
          x: { $case: 'range', value: [0, 16] },
          y: { $case: 'single', value: 0 },
          z: { $case: 'range', value: [0, 16] },
        },
      },
    ]);
    expect(areas).toHaveLength(2);
    expect(areas[0].isDefault).toBe(true);
    expect(areas[1]).toEqual({
      center: { x: 8, y: 0, z: 8 },
      halfExtents: { x: 8, z: 8 },
      isDefault: false,
    });
  });

  it('treats a one-element range as a point (no extent)', () => {
    const areas = toSpawnAreas([
      {
        name: 'p',
        position: {
          x: { $case: 'range', value: [5] },
          y: { $case: 'single', value: 0 },
          z: { $case: 'range', value: [7] },
        },
      },
    ]);
    expect(areas[0].center).toEqual({ x: 5, y: 0, z: 7 });
    expect(areas[0].halfExtents).toEqual({ x: 0, z: 0 });
  });
});

describe('createSpawnAreasBridge', () => {
  let ctx: BevySceneContext;
  let posted: Array<{ to?: string; msg?: { kind?: string; areas?: unknown } }>;
  let onmessage: ((ev: { data: unknown }) => void) | null;
  let disconnect: () => void;

  const setSpawnPoints = async (spawnPoints: unknown[]) => {
    ctx.editorComponents.Scene.createOrReplace(ctx.engine.RootEntity, {
      name: 's',
      description: '',
      layout: { base: { x: 0, y: 0 }, parcels: [{ x: 0, y: 0 }] },
      spawnPoints,
    } as never);
    await ctx.engine.update(1);
  };

  const emitEditorReady = () =>
    onmessage?.({ data: { to: 'page', msg: { kind: 'editor-ready' } } });

  beforeEach(() => {
    ctx = new BevySceneContext();
    posted = [];
    onmessage = null;
    disconnect = createSpawnAreasBridge({
      context: ctx,
      channel: {
        postMessage: m => posted.push(m as never),
        set onmessage(fn: ((ev: { data: unknown }) => void) | null) {
          onmessage = fn;
        },
        get onmessage() {
          return onmessage;
        },
        close: () => {},
      },
    });
  });

  afterEach(() => {
    disconnect();
    ctx.dispose();
  });

  it('should post the spawn areas when the Scene spawn points change', async () => {
    await setSpawnPoints([
      {
        name: 'p',
        default: true,
        position: {
          x: { $case: 'single', value: 8 },
          y: { $case: 'single', value: 0 },
          z: { $case: 'single', value: 8 },
        },
      },
    ]);
    const areaPosts = posted.filter(p => p.msg?.kind === 'set-spawn-areas');
    expect(areaPosts.length).toBeGreaterThanOrEqual(1);
    const last = areaPosts[areaPosts.length - 1];
    expect(last.to).toBe('scene');
    expect(Array.isArray(last.msg!.areas)).toBe(true);
    expect((last.msg!.areas as unknown[]).length).toBe(1);
  });

  it('should omit hidden spawn points and re-post when visibility changes', async () => {
    const hidden = new Set<string>();
    let notify: (() => void) | undefined;
    disconnect(); // rebuild the bridge with a visibility source
    disconnect = createSpawnAreasBridge({
      context: ctx,
      visibility: {
        isHidden: name => hidden.has(name),
        onChange: cb => {
          notify = cb;
          return () => {
            notify = undefined;
          };
        },
      },
      channel: {
        postMessage: m => posted.push(m as never),
        set onmessage(fn: ((ev: { data: unknown }) => void) | null) {
          onmessage = fn;
        },
        get onmessage() {
          return onmessage;
        },
        close: () => {},
      },
    });

    await setSpawnPoints([
      {
        name: 'a',
        position: {
          x: { $case: 'single', value: 1 },
          y: { $case: 'single', value: 0 },
          z: { $case: 'single', value: 1 },
        },
      },
      {
        name: 'b',
        position: {
          x: { $case: 'single', value: 2 },
          y: { $case: 'single', value: 0 },
          z: { $case: 'single', value: 2 },
        },
      },
    ]);
    const lastAreas = () => {
      const areaPosts = posted.filter(p => p.msg?.kind === 'set-spawn-areas');
      return areaPosts[areaPosts.length - 1].msg!.areas as unknown[];
    };
    expect(lastAreas().length).toBe(2); // both shown

    hidden.add('b');
    notify?.(); // eye toggle hid 'b'
    expect(lastAreas().length).toBe(1); // only 'a' remains
  });

  it('should RE-post (forced) on editor-ready even if the set is unchanged', async () => {
    await setSpawnPoints([
      {
        name: 'p',
        position: {
          x: { $case: 'single', value: 1 },
          y: { $case: 'single', value: 0 },
          z: { $case: 'single', value: 1 },
        },
      },
    ]);
    const before = posted.filter(p => p.msg?.kind === 'set-spawn-areas').length;
    emitEditorReady(); // agent (re)booted — needs the areas resent
    const after = posted.filter(p => p.msg?.kind === 'set-spawn-areas').length;
    expect(after).toBe(before + 1);
  });
});
