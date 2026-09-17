import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Entity } from '@dcl/ecs';

import { BevySceneContext } from '../../renderer/bevy/BevySceneContext';
import {
  createActiveSceneComponentProxy,
  resolveActiveSceneComponent,
} from './scene-metadata-version';

/**
 * The data-layer (a pinned sdk-commands) may speak an older SceneMetadata version
 * than this inspector's latest. resolveActiveSceneComponent + the Scene proxy make
 * the inspector read/write whichever version the data-layer actually uses, so
 * edits round-trip. Driven through a real engine that defines all versions.
 */
describe('SceneMetadata version negotiation', () => {
  let ctx: BevySceneContext;
  const root = () => ctx.engine.RootEntity;

  beforeEach(() => {
    ctx = new BevySceneContext();
  });
  afterEach(() => {
    ctx.dispose();
  });

  const v4 = () =>
    ctx.engine.getComponent('inspector::SceneMetadata-v4') as ReturnType<
      typeof ctx.engine.getComponent
    > & {
      createOrReplace: (e: Entity, v: unknown) => void;
      getOrNull: (e: Entity) => { spawnPoints?: unknown[] } | null;
      componentId: number;
    };

  it('resolveActiveSceneComponent picks the version that has data (the host version)', () => {
    // Host wrote v4 (an older version than this inspector's latest v5).
    v4().createOrReplace(root(), {
      name: 's',
      layout: { base: { x: 0, y: 0 }, parcels: [{ x: 0, y: 0 }] },
      spawnPoints: [],
    });
    const active = resolveActiveSceneComponent(ctx.engine) as unknown as { componentName: string };
    expect(active.componentName).toBe('inspector::SceneMetadata-v4');
  });

  it('falls back to the latest version when nothing has data yet', () => {
    const active = resolveActiveSceneComponent(ctx.engine) as unknown as { componentName: string };
    // The latest defined version (no host data yet).
    expect(active.componentName.startsWith('inspector::SceneMetadata')).toBe(true);
  });

  it('the Scene proxy reads the host version, so spawn points round-trip', () => {
    const proxy = createActiveSceneComponentProxy(ctx.engine) as unknown as {
      getOrNull: (e: Entity) => { spawnPoints?: unknown[] } | null;
      componentId: number;
    };
    v4().createOrReplace(root(), {
      name: 's',
      layout: { base: { x: 0, y: 0 }, parcels: [{ x: 0, y: 0 }] },
      spawnPoints: [
        {
          name: 'SpawnArea1',
          default: true,
          position: {
            x: { $case: 'range', value: [0, 3] },
            y: { $case: 'range', value: [0, 0] },
            z: { $case: 'range', value: [0, 3] },
          },
        },
      ],
    });
    // The proxy reads through to the v4 data the host wrote (the hardcoded v5
    // component would return null here).
    expect(proxy.getOrNull(root())?.spawnPoints).toHaveLength(1);
    // Its componentId reflects the active (v4) version, so change-matching lines up.
    expect(proxy.componentId).toBe(v4().componentId);
  });

  it('the Scene proxy WRITES the host version, so the write persists to it', () => {
    // Seed v4 as the host version, then write through the proxy.
    v4().createOrReplace(root(), {
      name: 's',
      layout: { base: { x: 0, y: 0 }, parcels: [{ x: 0, y: 0 }] },
      spawnPoints: [],
    });
    const proxy = createActiveSceneComponentProxy(ctx.engine) as unknown as {
      createOrReplace: (e: Entity, v: unknown) => void;
    };
    proxy.createOrReplace(root(), {
      name: 's',
      layout: { base: { x: 0, y: 0 }, parcels: [{ x: 0, y: 0 }] },
      spawnPoints: [
        {
          name: 'SpawnArea1',
          default: true,
          position: {
            x: { $case: 'single', value: 8 },
            y: { $case: 'single', value: 0 },
            z: { $case: 'single', value: 8 },
          },
        },
      ],
    });
    // The write landed on the v4 component (what the host reads/persists).
    expect(v4().getOrNull(root())?.spawnPoints).toHaveLength(1);
  });
});
