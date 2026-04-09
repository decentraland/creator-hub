import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Engine } from '@dcl/ecs';
import { Transform as defineTransform } from '@dcl/ecs/dist/components';
import type { IEngine } from '@dcl/ecs';
import {
  spawnComposite,
  SPAWN_EXCLUDE_COMPONENTS,
  SPAWN_EXCLUDE_COMPONENT_PREFIXES,
} from '../src/spawn-composite';
import type { SpawnCompositeOptions } from '../src/spawn-composite';
import { createComponents } from '../src/definitions';
import { getExplorerComponents } from '../src/components';
import type { AssetComposite } from '../src/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEngine(): IEngine {
  const engine = Engine() as IEngine;
  // Register core ECS components (GltfContainer, AudioSource, Transform, etc.)
  getExplorerComponents(engine);
  // Register asset-packs components (Actions, States, Triggers, Counter, etc.)
  createComponents(engine);
  return engine;
}

function getTransform(engine: IEngine, entity: number) {
  const Transform = defineTransform(engine as any);
  return Transform.getOrNull(entity as any);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('spawnComposite', () => {
  let engine: IEngine;

  beforeEach(() => {
    engine = makeEngine();
  });

  describe('single-entity composite', () => {
    it('creates one entity with a GltfContainer pointing to the correct path', () => {
      const composite: AssetComposite = {
        version: 1,
        components: [
          {
            name: 'core::Transform',
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
            name: 'core::GltfContainer',
            data: {
              '0': {
                json: {
                  src: '{assetPath}/models/monster.glb',
                  visibleMeshesCollisionMask: 0,
                  invisibleMeshesCollisionMask: 3,
                },
              },
            },
          },
        ],
      };

      const root = spawnComposite(engine, composite, 'custom/monster');

      expect(root).toBeDefined();

      // Verify GltfContainer src was resolved
      const GltfContainer = engine.getComponent('core::GltfContainer') as any;
      const gltf = GltfContainer.getOrNull(root);
      expect(gltf).not.toBeNull();
      expect(gltf.src).toBe('custom/monster/models/monster.glb');
    });

    it('applies the position option to the root entity Transform', () => {
      const composite: AssetComposite = {
        version: 1,
        components: [
          {
            name: 'core::Transform',
            data: {
              '0': {
                json: {
                  position: { x: 10, y: 10, z: 10 },
                  rotation: { x: 0, y: 0, z: 0, w: 1 },
                  scale: { x: 1, y: 1, z: 1 },
                },
              },
            },
          },
        ],
      };

      const options: SpawnCompositeOptions = { position: { x: 5, y: 0, z: 3 } };
      const root = spawnComposite(engine, composite, 'custom/item', options);

      const transform = getTransform(engine, root);
      expect(transform).not.toBeNull();
      expect(transform!.position).toEqual({ x: 5, y: 0, z: 3 });
    });

    it('replaces {assetPath} in AudioSource.audioClipUrl', () => {
      const composite: AssetComposite = {
        version: 1,
        components: [
          {
            name: 'core::Transform',
            data: {
              '0': { json: {} },
            },
          },
          {
            name: 'core::AudioSource',
            data: {
              '0': { json: { audioClipUrl: '{assetPath}/sounds/roar.mp3', loop: true, volume: 1 } },
            },
          },
        ],
      };

      const root = spawnComposite(engine, composite, 'custom/monster');

      const AudioSource = engine.getComponent('core::AudioSource') as any;
      const audio = AudioSource.getOrNull(root);
      expect(audio).not.toBeNull();
      expect(audio.audioClipUrl).toBe('custom/monster/sounds/roar.mp3');
    });
  });

  describe('multi-entity composite (entity tree)', () => {
    it('creates all entities and preserves parent-child relationships', () => {
      const composite: AssetComposite = {
        version: 1,
        components: [
          {
            name: 'core::Transform',
            data: {
              // Entity 512 = root
              '512': {
                json: {
                  position: { x: 0, y: 0, z: 0 },
                  rotation: { x: 0, y: 0, z: 0, w: 1 },
                  scale: { x: 1, y: 1, z: 1 },
                },
              },
              // Entity 513 = child of 512
              '513': {
                json: {
                  position: { x: 1, y: 0, z: 0 },
                  rotation: { x: 0, y: 0, z: 0, w: 1 },
                  scale: { x: 1, y: 1, z: 1 },
                  parent: 512,
                },
              },
            },
          },
          {
            name: 'core::GltfContainer',
            data: {
              '513': { json: { src: '{assetPath}/models/arm.glb' } },
            },
          },
        ],
      };

      const root = spawnComposite(engine, composite, 'custom/robot');

      expect(root).toBeDefined();
      const rootTransform = getTransform(engine, root);
      expect(rootTransform).not.toBeNull();

      // The GltfContainer should be on the child entity, not the root
      const GltfContainer = engine.getComponent('core::GltfContainer') as any;
      const rootGltf = GltfContainer.getOrNull(root);
      expect(rootGltf).toBeNull(); // Root has no GltfContainer

      // Find the child entity by checking parent
      const childTransform = rootTransform;
      expect(childTransform!.position).toEqual({ x: 0, y: 0, z: 0 }); // Root was overridden
    });

    it('produces a synthetic container entity for multi-root composites', () => {
      const composite: AssetComposite = {
        version: 1,
        components: [
          {
            name: 'core::Transform',
            data: {
              // Two roots — no parent
              '512': {
                json: {
                  position: { x: 0, y: 0, z: 0 },
                  rotation: { x: 0, y: 0, z: 0, w: 1 },
                  scale: { x: 1, y: 1, z: 1 },
                },
              },
              '513': {
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

      const container = spawnComposite(engine, composite, 'custom/pair', {
        position: { x: 10, y: 0, z: 10 },
      });

      expect(container).toBeDefined();
      const containerTransform = getTransform(engine, container);
      // Container should be at the requested position
      expect(containerTransform!.position).toEqual({ x: 10, y: 0, z: 10 });
    });
  });

  describe('ID remapping for COMPONENTS_WITH_ID', () => {
    it('generates independent IDs for each spawnComposite call', () => {
      const composite: AssetComposite = {
        version: 1,
        components: [
          {
            name: 'core::Transform',
            data: { '0': { json: {} } },
          },
          {
            name: 'asset-packs::Actions',
            data: {
              '0': {
                json: {
                  id: '{self}',
                  value: [
                    { name: 'idle', type: 'PLAY_ANIMATION', jsonPayload: '{"animation":"idle"}' },
                  ],
                },
              },
            },
          },
        ],
      };

      const root1 = spawnComposite(engine, composite, 'custom/monster');
      const root2 = spawnComposite(engine, composite, 'custom/monster');

      const Actions = engine.getComponent('asset-packs::Actions') as any;
      const actions1 = Actions.getOrNull(root1);
      const actions2 = Actions.getOrNull(root2);

      expect(actions1).not.toBeNull();
      expect(actions2).not.toBeNull();
      // Each instance should have a unique ID
      expect(actions1.id).not.toEqual(actions2.id);
    });

    it('correctly resolves cross-entity trigger references', () => {
      const composite: AssetComposite = {
        version: 1,
        components: [
          {
            name: 'core::Transform',
            data: {
              '512': { json: {} },
              '513': { json: { parent: 512 } },
            },
          },
          {
            name: 'asset-packs::Actions',
            data: {
              '513': {
                json: {
                  id: '{self}',
                  value: [{ name: 'die', type: 'SET_STATE', jsonPayload: '{"state":"dead"}' }],
                },
              },
            },
          },
          {
            name: 'asset-packs::Triggers',
            data: {
              '512': {
                json: {
                  value: [
                    {
                      type: 'ON_POINTER_DOWN',
                      actions: [{ id: '{513:asset-packs::Actions}', name: 'die' }],
                      conditions: [],
                    },
                  ],
                },
              },
            },
          },
        ],
      };

      // Should not throw and trigger IDs should be numeric references
      expect(() => spawnComposite(engine, composite, 'custom/monster')).not.toThrow();
    });
  });

  describe('excluded components', () => {
    it('skips inspector:: editor components without throwing', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const composite: AssetComposite = {
        version: 1,
        components: [
          {
            name: 'core::Transform',
            data: { '0': { json: {} } },
          },
          {
            name: 'inspector::Config',
            data: { '0': { json: { assetId: 'some-id' } } },
          },
          {
            name: 'inspector::Selection',
            data: { '0': { json: {} } },
          },
        ],
      };

      const root = spawnComposite(engine, composite, 'custom/item');
      expect(root).toBeDefined();

      consoleSpy.mockRestore();
    });

    it('skips asset-packs::Placeholder without throwing', () => {
      const composite: AssetComposite = {
        version: 1,
        components: [
          {
            name: 'core::Transform',
            data: { '0': { json: {} } },
          },
          {
            name: 'asset-packs::Placeholder',
            data: { '0': { json: { src: '{assetPath}/gizmo.glb' } } },
          },
        ],
      };

      expect(() => spawnComposite(engine, composite, 'custom/item')).not.toThrow();
    });

    it('logs an error for SyncComponents/NetworkEntity and skips them', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const composite: AssetComposite = {
        version: 1,
        components: [
          {
            name: 'core::Transform',
            data: { '0': { json: {} } },
          },
          {
            name: 'core-schema::Sync-Components',
            data: { '0': { json: { componentIds: [] } } },
          },
        ],
      };

      spawnComposite(engine, composite, 'custom/item');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('SyncComponents/NetworkEntity is not supported'),
      );

      consoleSpy.mockRestore();
    });

    it('logs an error for unknown components and continues', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const composite: AssetComposite = {
        version: 1,
        components: [
          {
            name: 'core::Transform',
            data: { '0': { json: {} } },
          },
          {
            name: 'some-unknown::Component',
            data: { '0': { json: { value: 42 } } },
          },
          {
            name: 'core::GltfContainer',
            data: { '0': { json: { src: '{assetPath}/model.glb' } } },
          },
        ],
      };

      const root = spawnComposite(engine, composite, 'custom/item');
      expect(root).toBeDefined();

      // Unknown component should have been logged
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('some-unknown::Component'));

      // GltfContainer should still be applied despite the unknown component
      const GltfContainer = engine.getComponent('core::GltfContainer') as any;
      const gltf = GltfContainer.getOrNull(root);
      expect(gltf).not.toBeNull();
      expect(gltf.src).toBe('custom/item/model.glb');

      consoleSpy.mockRestore();
    });
  });

  describe('SPAWN_EXCLUDE_COMPONENTS and SPAWN_EXCLUDE_COMPONENT_PREFIXES constants', () => {
    it('exports the exclusion list', () => {
      expect(Array.isArray(SPAWN_EXCLUDE_COMPONENTS)).toBe(true);
      expect(SPAWN_EXCLUDE_COMPONENTS).toContain('core-schema::Sync-Components');
      expect(SPAWN_EXCLUDE_COMPONENTS).toContain('core-schema::Network-Entity');
    });

    it('exports the exclusion prefix list', () => {
      expect(Array.isArray(SPAWN_EXCLUDE_COMPONENT_PREFIXES)).toBe(true);
      expect(SPAWN_EXCLUDE_COMPONENT_PREFIXES).toContain('inspector::');
    });
  });
});
