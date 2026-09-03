import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IEngine, TransformComponentExtended } from '@dcl/ecs';
import { Engine } from '@dcl/ecs';
import type { AssetComposite, TriggersComponent } from '../src/definitions';
import { ComponentName } from '../src/enums';
import { getExplorerComponents } from '../src/components';
import { defineAllComponents } from '../src/versioning/registry';
import { spawnCustomItem } from '../src/spawn';

// Component name constants — mirrors those used in spawn.ts
const CORE_TRANSFORM = 'core::Transform';
const CORE_GLTF_CONTAINER = 'core::GltfContainer';
const CORE_SYNC_COMPONENTS = 'core-schema::Sync-Components';

/**
 * Build an engine with:
 *  - all core ECS components (GltfContainer, AudioSource, etc.) via getExplorerComponents
 *  - all asset-packs versioned components (Actions, Triggers, etc.) via defineAllComponents
 */
function buildEngine(): IEngine {
  const engine = Engine();
  getExplorerComponents(engine); // registers core components
  defineAllComponents(engine); // registers asset-packs components
  return engine;
}

/** Retrieve the Transform component from the engine (typed). */
function getTransform(engine: IEngine): TransformComponentExtended {
  return engine.getComponent(CORE_TRANSFORM) as TransformComponentExtended;
}

/** Retrieve the Triggers component from the engine (typed). */
function getTriggers(engine: IEngine): TriggersComponent {
  return engine.getComponent(ComponentName.TRIGGERS) as TriggersComponent;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function singleEntityComposite(): AssetComposite {
  return {
    version: 1,
    components: [
      {
        name: CORE_TRANSFORM,
        data: {
          '0': {
            json: {
              position: { x: 1, y: 2, z: 3 },
              rotation: { x: 0, y: 0, z: 0, w: 1 },
              scale: { x: 1, y: 1, z: 1 },
            },
          },
        },
      },
      {
        name: CORE_GLTF_CONTAINER,
        data: {
          '0': { json: { src: '{assetPath}/model.glb' } },
        },
      },
    ],
  };
}

function multiEntityComposite(): AssetComposite {
  return {
    version: 1,
    components: [
      {
        name: CORE_TRANSFORM,
        data: {
          '0': {
            json: {
              position: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0, w: 1 },
              scale: { x: 1, y: 1, z: 1 },
            },
          },
          '512': {
            json: {
              parent: 0,
              position: { x: 0, y: 1, z: 0 },
              rotation: { x: 0, y: 0, z: 0, w: 1 },
              scale: { x: 1, y: 1, z: 1 },
            },
          },
        },
      },
      {
        name: CORE_GLTF_CONTAINER,
        data: {
          '0': { json: { src: '{assetPath}/body.glb' } },
          '512': { json: { src: '{assetPath}/head.glb' } },
        },
      },
    ],
  };
}

function multiRootComposite(): AssetComposite {
  return {
    version: 1,
    components: [
      {
        name: CORE_TRANSFORM,
        data: {
          '0': {
            json: {
              position: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0, w: 1 },
              scale: { x: 1, y: 1, z: 1 },
            },
          },
          '512': {
            json: {
              position: { x: 2, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0, w: 1 },
              scale: { x: 1, y: 1, z: 1 },
            },
          },
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('spawnCustomItem', () => {
  let engine: IEngine;
  let Transform_: TransformComponentExtended;
  let Triggers_: TriggersComponent;

  beforeEach(() => {
    engine = buildEngine();
    Transform_ = getTransform(engine);
    Triggers_ = getTriggers(engine);
  });

  describe('when given a single-entity composite', () => {
    it('should create exactly one new entity', () => {
      const before = Array.from(engine.getEntitiesWith(Transform_)).length;
      spawnCustomItem(engine, singleEntityComposite(), Transform_, Triggers_);
      const after = Array.from(engine.getEntitiesWith(Transform_)).length;
      expect(after).toBe(before + 1);
    });

    it('should return the spawned entity', () => {
      const root = spawnCustomItem(engine, singleEntityComposite(), Transform_, Triggers_);
      expect(typeof root).toBe('number');
    });

    it('should apply the caller-specified spawn position to the entity', () => {
      const root = spawnCustomItem(
        engine,
        singleEntityComposite(),
        Transform_,
        Triggers_,
        undefined,
        { position: { x: 5, y: 6, z: 7 } },
      );
      const t = Transform_.get(root);
      expect(t.position).toEqual({ x: 5, y: 6, z: 7 });
    });
  });

  describe('when given a multi-entity composite (parent/child)', () => {
    it('should create multiple entities', () => {
      const before = Array.from(engine.getEntitiesWith(Transform_)).length;
      spawnCustomItem(engine, multiEntityComposite(), Transform_, Triggers_);
      const after = Array.from(engine.getEntitiesWith(Transform_)).length;
      expect(after).toBeGreaterThan(before + 1);
    });

    it('should return the root entity', () => {
      const root = spawnCustomItem(engine, multiEntityComposite(), Transform_, Triggers_);
      expect(typeof root).toBe('number');
    });

    it('should set the caller-specified position on the root entity', () => {
      const root = spawnCustomItem(
        engine,
        multiEntityComposite(),
        Transform_,
        Triggers_,
        undefined,
        { position: { x: 10, y: 0, z: 0 } },
      );
      const t = Transform_.get(root);
      expect(t.position).toEqual({ x: 10, y: 0, z: 0 });
    });
  });

  describe('when given a multi-root composite', () => {
    it('should create a synthetic wrapper entity and return it', () => {
      const before = Array.from(engine.getEntitiesWith(Transform_)).length;
      const root = spawnCustomItem(engine, multiRootComposite(), Transform_, Triggers_);
      const after = Array.from(engine.getEntitiesWith(Transform_)).length;
      // 2 root entities + 1 synthetic wrapper = 3 new entities
      expect(after).toBe(before + 3);
      // Returned entity is the wrapper
      const t = Transform_.get(root);
      expect(t).toBeDefined();
    });
  });

  describe('when called twice with the same composite', () => {
    it('should produce two independent root entities with different IDs', () => {
      const root1 = spawnCustomItem(engine, singleEntityComposite(), Transform_, Triggers_);
      const root2 = spawnCustomItem(engine, singleEntityComposite(), Transform_, Triggers_);
      expect(root1).not.toBe(root2);
    });
  });

  describe('when basePath is provided', () => {
    it('should replace {assetPath} in GltfContainer.src', () => {
      const GltfContainer = engine.getComponent(CORE_GLTF_CONTAINER) as any;
      const root = spawnCustomItem(
        engine,
        singleEntityComposite(),
        Transform_,
        Triggers_,
        undefined,
        { basePath: 'assets/custom/my-monster' },
      );
      const gltf = GltfContainer.getOrNull(root);
      expect(gltf).not.toBeNull();
      expect(gltf!.src).toBe('assets/custom/my-monster/model.glb');
      expect(gltf!.src).not.toContain('{assetPath}');
    });
  });

  describe('when Actions component has {assetPath} in PLAY_SOUND payload', () => {
    it('should replace {assetPath} with basePath', () => {
      const actionComposite: AssetComposite = {
        version: 1,
        components: [
          {
            name: CORE_TRANSFORM,
            data: {
              '0': {
                json: {
                  position: { x: 0, y: 0, z: 0 },
                  rotation: { x: 0, y: 0, z: 0, w: 1 },
                  scale: { x: 1, y: 1, z: 1 },
                },
              },
            },
          },
          {
            name: ComponentName.ACTIONS,
            data: {
              '0': {
                json: {
                  id: '{self}',
                  value: [
                    {
                      name: 'play',
                      type: 'play_sound',
                      jsonPayload: JSON.stringify({
                        src: '{assetPath}/sound.mp3',
                        loop: false,
                        volume: 1,
                      }),
                    },
                  ],
                },
              },
            },
          },
        ],
      };

      const Actions = engine.getComponent(ComponentName.ACTIONS) as any;
      const root = spawnCustomItem(engine, actionComposite, Transform_, Triggers_, undefined, {
        basePath: 'assets/custom/my-item',
      });
      const actions = Actions.getOrNull(root);
      expect(actions).not.toBeNull();
      const payload = JSON.parse(actions!.value[0].jsonPayload);
      expect(payload.src).toBe('assets/custom/my-item/sound.mp3');
      expect(payload.src).not.toContain('{assetPath}');
    });
  });

  describe('when Triggers component has {self:ComponentName} ID references', () => {
    it('should remap ID references to real integers', () => {
      const triggersComposite: AssetComposite = {
        version: 1,
        components: [
          {
            name: CORE_TRANSFORM,
            data: {
              '0': {
                json: {
                  position: { x: 0, y: 0, z: 0 },
                  rotation: { x: 0, y: 0, z: 0, w: 1 },
                  scale: { x: 1, y: 1, z: 1 },
                },
              },
            },
          },
          {
            name: ComponentName.ACTIONS,
            data: {
              '0': {
                json: {
                  id: '{self}',
                  value: [{ name: 'open', type: 'set_state', jsonPayload: '{"state":"open"}' }],
                },
              },
            },
          },
          {
            name: ComponentName.TRIGGERS,
            data: {
              '0': {
                json: {
                  value: [
                    {
                      type: 'on_click',
                      actions: [{ id: `{self:${ComponentName.ACTIONS}}`, name: 'open' }],
                      conditions: [],
                    },
                  ],
                },
              },
            },
          },
        ],
      };

      const root = spawnCustomItem(engine, triggersComposite, Transform_, Triggers_);
      const triggers = Triggers_.getOrNull(root);
      expect(triggers).not.toBeNull();
      const actionId = triggers!.value[0].actions[0].id;
      // Should be a real integer, not a placeholder string
      expect(typeof actionId).toBe('number');
      expect(actionId).toBeGreaterThan(0);
    });
  });

  describe('when SyncComponents is present but sdkHelpers is not provided', () => {
    it('should not throw', () => {
      const syncComposite: AssetComposite = {
        version: 1,
        components: [
          {
            name: CORE_TRANSFORM,
            data: {
              '0': {
                json: {
                  position: { x: 0, y: 0, z: 0 },
                  rotation: { x: 0, y: 0, z: 0, w: 1 },
                  scale: { x: 1, y: 1, z: 1 },
                },
              },
            },
          },
          {
            name: CORE_SYNC_COMPONENTS,
            data: {
              '0': { json: { value: ['core::Transform'] } },
            },
          },
        ],
      };

      expect(() => spawnCustomItem(engine, syncComposite, Transform_, Triggers_)).not.toThrow();
    });

    it('should call sdkHelpers.syncEntity when sdkHelpers is provided', () => {
      const syncEntity = vi.fn();
      const syncComposite: AssetComposite = {
        version: 1,
        components: [
          {
            name: CORE_TRANSFORM,
            data: {
              '0': {
                json: {
                  position: { x: 0, y: 0, z: 0 },
                  rotation: { x: 0, y: 0, z: 0, w: 1 },
                  scale: { x: 1, y: 1, z: 1 },
                },
              },
            },
          },
          {
            name: CORE_SYNC_COMPONENTS,
            data: {
              '0': { json: { value: ['core::Transform'] } },
            },
          },
        ],
      };

      spawnCustomItem(engine, syncComposite, Transform_, Triggers_, { syncEntity });
      expect(syncEntity).toHaveBeenCalledOnce();
    });
  });

  describe('when composite contains an unknown/missing component', () => {
    it('should not throw and should still return the root entity', () => {
      const unknownComposite: AssetComposite = {
        version: 1,
        components: [
          {
            name: CORE_TRANSFORM,
            data: {
              '0': {
                json: {
                  position: { x: 0, y: 0, z: 0 },
                  rotation: { x: 0, y: 0, z: 0, w: 1 },
                  scale: { x: 1, y: 1, z: 1 },
                },
              },
            },
          },
          {
            name: 'non-existent::UnknownComponent-v99',
            data: { '0': { json: { value: 'foo' } } },
          },
        ],
      };

      let root: number | undefined;
      expect(() => {
        root = spawnCustomItem(engine, unknownComposite, Transform_, Triggers_);
      }).not.toThrow();
      expect(root).toBeDefined();
    });
  });

  describe('when composite is empty', () => {
    it('should throw an error', () => {
      const empty: AssetComposite = { version: 1, components: [] };
      expect(() => spawnCustomItem(engine, empty, Transform_, Triggers_)).toThrow(
        '[spawnCustomItem] Composite contains no entities',
      );
    });
  });
});
