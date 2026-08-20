import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as components from '@dcl/ecs/dist/components';

import { BevySceneContext } from './BevySceneContext';
import { createBrokenAssetsBridge } from './broken-assets-bridge';

/**
 * The broken-assets bridge posts a marker position for each entity whose
 * GltfContainer src is invalid (missing from the asset catalog), so the agent can
 * draw a placeholder in the viewport (#1465). Driven with a real BevySceneContext
 * (its engine carries GltfContainer + Transform) + a fake channel recorder and a
 * stub catalog.
 */
describe('createBrokenAssetsBridge', () => {
  let ctx: BevySceneContext;
  let posted: Array<{ to?: string; msg?: { kind?: string; assets?: unknown } }>;
  let onmessage: ((ev: { data: unknown }) => void) | null;
  let disconnect: () => void;
  let validSrcs: Set<string>;
  let notifyAssets: (() => void) | undefined;

  const IDENTITY = { rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } };

  const lastBrokenPost = () => {
    const posts = posted.filter(p => p.msg?.kind === 'set-broken-assets');
    return posts.at(-1)?.msg?.assets as { entity: number; position: unknown }[] | undefined;
  };

  beforeEach(() => {
    ctx = new BevySceneContext();
    posted = [];
    onmessage = null;
    validSrcs = new Set<string>();
    disconnect = createBrokenAssetsBridge({
      context: ctx,
      assets: {
        isValidSrc: src => validSrcs.has(src),
        onChange: cb => {
          notifyAssets = cb;
          return () => {
            notifyAssets = undefined;
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
  });

  afterEach(() => {
    disconnect();
    ctx.dispose();
  });

  const addModel = async (src: string, position: { x: number; y: number; z: number }) => {
    const GltfContainer = components.GltfContainer(ctx.engine);
    const entity = ctx.engine.addEntity();
    ctx.Transform.create(entity, { ...IDENTITY, position, parent: ctx.engine.RootEntity });
    GltfContainer.create(entity, { src, visibleMeshesCollisionMask: 0 });
    await ctx.engine.update(1);
    return entity;
  };

  it('should post a marker at the position of an entity with an invalid src', async () => {
    const entity = await addModel('assets/missing.glb', { x: 4, y: 0, z: 6 });

    const assets = lastBrokenPost();
    expect(assets).toEqual([{ entity: entity as number, position: { x: 4, y: 0, z: 6 } }]);
  });

  it('should NOT post a marker for a valid src', async () => {
    validSrcs.add('assets/real.glb');
    await addModel('assets/real.glb', { x: 1, y: 0, z: 1 });

    expect(lastBrokenPost()).toEqual([]);
  });

  it('should NOT post a marker for an empty src', async () => {
    await addModel('', { x: 1, y: 0, z: 1 });
    expect(lastBrokenPost()).toEqual([]);
  });

  it('should omit a hidden broken entity', async () => {
    const entity = await addModel('assets/missing.glb', { x: 4, y: 0, z: 6 });
    ctx.editorComponents.Hide.createOrReplace(entity, { value: true });
    await ctx.engine.update(1);

    expect(lastBrokenPost()).toEqual([]);
  });

  it('should re-post when the catalog changes (the missing file is restored)', async () => {
    await addModel('assets/missing.glb', { x: 4, y: 0, z: 6 });
    expect(lastBrokenPost()).toHaveLength(1);

    // The file is restored on disk → the catalog now resolves the src.
    validSrcs.add('assets/missing.glb');
    notifyAssets?.();

    expect(lastBrokenPost()).toEqual([]);
  });

  it('should re-post (force) on editor-ready', async () => {
    await addModel('assets/missing.glb', { x: 4, y: 0, z: 6 });
    posted.length = 0;

    onmessage?.({ data: { to: 'page', msg: { kind: 'editor-ready' } } });

    expect(lastBrokenPost()).toHaveLength(1);
  });
});
