import { describe, it, expect } from 'vitest';
import { EntityType } from '@dcl/schemas';
import { type IEngine, GltfContainer as GltfEngine, Transform as TransformEngine } from '@dcl/ecs';

import { initTestEngine } from '../../../../../test/data-layer/utils';
import { createEnumEntityId } from '../../enum-entity';
import { ROOT } from '../../tree';
import { addAsset } from './index';

/**
 * Integration coverage for `addAsset` in the multi-entity custom-asset path.
 *
 * Reproduces the on-disk shape produced by `create-custom-asset` when the
 * user packs two smart items into one custom asset: two root entities
 * (composite IDs 512 and 513), each carrying its own `GltfContainer` with a
 * `{assetPath}/…` placeholder. After spawning, both spawned entities'
 * GltfContainer must hold the substituted path. With the old walker (or any
 * regression in `toProtoComposite`/`substituteAssetPathInComposite`
 * integration on the inspector side), the literal `{assetPath}` token would
 * survive into the engine — which is what the user's bug report shows.
 */
describe('addAsset — multi-entity custom asset', () => {
  const context = initTestEngine({
    baseUrl: '/',
    entity: {
      content: [],
      metadata: {},
      version: 'v3',
      type: EntityType.SCENE,
      timestamp: 1,
      pointers: ['0, 0'],
    },
    id: 'multi-entity-test',
  });

  it('substitutes {assetPath} in every entity GltfContainer.src on spawn', async () => {
    const { inspectorEngine, tick } = context;
    const engine: IEngine = inspectorEngine;
    const enumEntity = createEnumEntityId(engine);
    const base = 'assets/custom/pair';

    const composite = {
      version: 1,
      components: [
        {
          name: TransformEngine.componentName,
          data: {
            '512': {
              json: {
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0, w: 1 },
                scale: { x: 1, y: 1, z: 1 },
              },
            },
            '513': {
              json: {
                position: { x: 1, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0, w: 1 },
                scale: { x: 1, y: 1, z: 1 },
              },
            },
          },
        },
        {
          name: GltfEngine.componentName,
          data: {
            '512': {
              json: { src: '{assetPath}/A.glb', visibleMeshesCollisionMask: 1 },
            },
            '513': {
              json: { src: '{assetPath}/B.glb', visibleMeshesCollisionMask: 1 },
            },
          },
        },
      ],
    } as any;

    const mainEntity = addAsset(engine)(
      ROOT,
      'A.glb',
      'pair',
      { x: 0, y: 0, z: 0 },
      base,
      enumEntity,
      composite,
      'pair-asset-id',
      true,
    );

    await tick();

    expect(mainEntity).toBeGreaterThan(0);

    const GltfContainer = engine.getComponent(GltfEngine.componentName) as typeof GltfEngine;

    // Collect every GltfContainer.src — there are pre-existing scene entries
    // (spawn-point visuals etc.) the test doesn't control, so filter to the
    // ones we just spawned by name pattern.
    const ourSrcs: string[] = [];
    for (const [, value] of engine.getEntitiesWith(GltfContainer)) {
      if (value.src.endsWith('/A.glb') || value.src.endsWith('/B.glb')) {
        ourSrcs.push(value.src);
      }
      // Defensive: nothing in the spawned subtree should keep the placeholder.
      expect(value.src).not.toContain('{assetPath}');
    }

    expect(ourSrcs.sort()).toEqual([`${base}/A.glb`, `${base}/B.glb`]);
  });

  it('substitutes {assetPath} for a 2-entity-parented-to-0 composite (user repro)', async () => {
    // Exact shape produced by `create-custom-asset` when the user packs a
    // Siren-like smart item together with a Click Area: two entities (512 and
    // 513) both parented to a synthetic root (entity 0), only 512 carrying
    // resource-bearing components, including a PLAY_SOUND Action with a
    // `{assetPath}/…` path in its `jsonPayload`. Mirrors the composite from
    // the user's bug report verbatim down to shape.
    const { inspectorEngine, tick } = context;
    const engine: IEngine = inspectorEngine;
    const enumEntity = createEnumEntityId(engine);
    const base = 'assets/custom/siren_clickarea';

    const composite = {
      version: 1,
      components: [
        {
          name: 'core::Transform',
          data: {
            '512': {
              json: {
                position: { x: -2, y: 0, z: 1.625 },
                scale: { x: 1, y: 1, z: 1 },
                rotation: { x: 0, y: 0, z: 0, w: 1 },
                parent: 0,
              },
            },
            '513': {
              json: {
                position: { x: 2, y: 0, z: -1.625 },
                rotation: { x: 0, y: 0, z: 0, w: 1 },
                scale: { x: 1, y: 1, z: 1 },
                parent: 0,
              },
            },
          },
        },
        {
          name: 'core::GltfContainer',
          data: {
            '512': {
              json: {
                src: '{assetPath}/Siren.glb',
                visibleMeshesCollisionMask: 1,
                invisibleMeshesCollisionMask: 2,
              },
            },
          },
        },
        {
          name: 'core-schema::Name',
          data: {
            '512': { json: { value: 'Siren' } },
            '513': { json: { value: 'Click Area' } },
          },
        },
        {
          name: 'asset-packs::Actions',
          data: {
            '512': {
              json: {
                id: '{self}',
                value: [
                  {
                    name: 'Loop Sound',
                    type: 'play_sound',
                    jsonPayload: '{"src":"{assetPath}/siren.mp3","loop":true}',
                  },
                  {
                    name: 'Loop Animation',
                    type: 'play_animation',
                    jsonPayload: '{"animation":"activate","loop":true}',
                  },
                ],
              },
            },
          },
        },
      ],
    } as any;

    const mainEntity = addAsset(engine)(
      ROOT,
      'Siren.glb',
      'pair',
      { x: 0, y: 0, z: 0 },
      base,
      enumEntity,
      composite,
      'siren-pair-id',
      true,
    );
    await tick();

    expect(mainEntity).toBeGreaterThan(0);

    const GltfContainer = engine.getComponent('core::GltfContainer') as typeof GltfEngine;

    // The only spawned GltfContainer should be on the Siren entity, with the
    // substituted path — never the literal `{assetPath}` token.
    let sirenSrc: string | undefined;
    for (const [, value] of engine.getEntitiesWith(GltfContainer)) {
      if (value.src.endsWith('Siren.glb')) sirenSrc = value.src;
      expect(value.src).not.toContain('{assetPath}');
    }
    expect(sirenSrc).toBe(`${base}/Siren.glb`);

    // Walk the live Actions component on the Siren entity and confirm the
    // PLAY_SOUND `jsonPayload.src` was substituted — the regression surface
    // the user is seeing.
    const Actions = engine.getComponent('asset-packs::Actions') as any;
    let playSoundSrc: string | undefined;
    for (const [, actions] of engine.getEntitiesWith(Actions)) {
      for (const action of (actions as any).value) {
        if (action.type === 'play_sound') {
          const payload = JSON.parse(action.jsonPayload);
          playSoundSrc = payload.src;
        }
      }
    }
    expect(playSoundSrc).toBe(`${base}/siren.mp3`);
  });

  it('substitutes {assetPath} when the composite is frozen (Redux state shape)', async () => {
    // The real production composite comes from Redux state, which Redux
    // Toolkit (via Immer) auto-freezes. The walker mutates per-component
    // payloads in-place; if those objects are frozen, the writes silently
    // fail in sloppy mode or throw in strict — either way `{assetPath}`
    // survives into the engine. Reproduces the user's bug by deep-freezing
    // the composite before calling `addAsset`.
    const { inspectorEngine, tick } = context;
    const engine: IEngine = inspectorEngine;
    const enumEntity = createEnumEntityId(engine);
    const base = 'assets/custom/frozen_repro';

    const deepFreeze = <T>(v: T): T => {
      if (v && typeof v === 'object') {
        Object.values(v as Record<string, unknown>).forEach(deepFreeze);
        Object.freeze(v);
      }
      return v;
    };

    const composite = deepFreeze({
      version: 1,
      components: [
        {
          name: 'core::Transform',
          data: {
            '512': {
              json: {
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0, w: 1 },
                scale: { x: 1, y: 1, z: 1 },
                parent: 0,
              },
            },
          },
        },
        {
          name: 'core::GltfContainer',
          data: {
            '512': {
              json: { src: '{assetPath}/Siren.glb', visibleMeshesCollisionMask: 1 },
            },
          },
        },
      ],
    }) as any;

    const mainEntity = addAsset(engine)(
      ROOT,
      'Siren.glb',
      'frozen_repro',
      { x: 0, y: 0, z: 0 },
      base,
      enumEntity,
      composite,
      'frozen-id',
      true,
    );
    await tick();

    expect(mainEntity).toBeGreaterThan(0);

    const GltfContainer = engine.getComponent('core::GltfContainer') as typeof GltfEngine;
    let sirenSrc: string | undefined;
    for (const [, value] of engine.getEntitiesWith(GltfContainer)) {
      if (value.src.endsWith('Siren.glb')) sirenSrc = value.src;
      expect(value.src).not.toContain('{assetPath}');
    }
    expect(sirenSrc).toBe(`${base}/Siren.glb`);
  });
});
