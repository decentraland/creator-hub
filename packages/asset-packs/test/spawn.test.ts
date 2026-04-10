import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@dcl/ecs/dist/engine';
import { Transform as DefineTransform, Name as DefineName } from '@dcl/ecs/dist/components';
import { getComponentEntityTree } from '@dcl/ecs';
import { spawnCustomItem, despawnCustomItem } from '../src/spawn';
import type { AssetComposite } from '../src/types';
import { ComponentName } from '../src/enums';
import { defineAllComponents } from '../src/versioning/registry';

// Helper: bootstrap the ECS engine with all asset-packs components registered
function createTestEngine() {
  const engine = Engine();
  defineAllComponents(engine);
  return engine;
}

describe('spawnCustomItem', () => {
  it('should create a single entity for a single-entity composite', () => {
    const engine = createTestEngine();
    const Transform = DefineTransform(engine);

    const composite: AssetComposite = {
      version: 1,
      components: [
        {
          name: 'core::GltfContainer',
          data: {
            '0': { json: { src: '{assetPath}/model.glb' } },
          },
        },
      ],
    };

    const entity = spawnCustomItem(engine, composite, 'custom/monster', {
      position: { x: 4, y: 0, z: 4 },
    });

    expect(entity).toBeTruthy();

    const transform = Transform.getOrNull(entity);
    expect(transform).not.toBeNull();
    expect(transform!.position).toEqual({ x: 4, y: 0, z: 4 });
  });

  it('should replace {assetPath} in GltfContainer src', () => {
    const engine = createTestEngine();

    const composite: AssetComposite = {
      version: 1,
      components: [
        {
          name: 'core::GltfContainer',
          data: {
            '0': { json: { src: '{assetPath}/mesh.glb' } },
          },
        },
      ],
    };

    const entity = spawnCustomItem(engine, composite, 'custom/my-item');

    // GltfContainer should have resolved src
    const GltfContainer = engine.getComponent('core::GltfContainer') as any;
    const gltf = GltfContainer.getOrNull(entity);
    expect(gltf).not.toBeNull();
    expect(gltf!.src).toBe('custom/my-item/mesh.glb');
  });

  it('should replace {assetPath} in AudioSource audioClipUrl', () => {
    const engine = createTestEngine();

    const composite: AssetComposite = {
      version: 1,
      components: [
        {
          name: 'core::AudioSource',
          data: {
            '0': {
              json: {
                audioClipUrl: '{assetPath}/sound.mp3',
                playing: false,
                loop: false,
                volume: 1,
              },
            },
          },
        },
      ],
    };

    const entity = spawnCustomItem(engine, composite, 'custom/sound-item');

    const AudioSource = engine.getComponent('core::AudioSource') as any;
    const audio = AudioSource.getOrNull(entity);
    expect(audio).not.toBeNull();
    expect(audio!.audioClipUrl).toBe('custom/sound-item/sound.mp3');
  });

  it('should create a parent entity for multi-entity composite (parent + child)', () => {
    const engine = createTestEngine();
    const Transform = DefineTransform(engine);

    // Entity 0 is parent, entity 1 is child (parent=0)
    const composite: AssetComposite = {
      version: 1,
      components: [
        {
          name: 'core::Transform',
          data: {
            '0': { json: { position: { x: 0, y: 0, z: 0 } } },
            '1': {
              json: { position: { x: 1, y: 0, z: 0 }, parent: 0 },
            },
          },
        },
        {
          name: 'core::GltfContainer',
          data: {
            '0': { json: { src: '{assetPath}/parent.glb' } },
            '1': { json: { src: '{assetPath}/child.glb' } },
          },
        },
      ],
    };

    const rootEntity = spawnCustomItem(engine, composite, 'custom/multi', {
      position: { x: 2, y: 0, z: 2 },
    });

    expect(rootEntity).toBeTruthy();
    const rootTransform = Transform.getOrNull(rootEntity);
    expect(rootTransform).not.toBeNull();
    expect(rootTransform!.position).toEqual({ x: 2, y: 0, z: 2 });

    // Find the child entity (parented to root)
    let childFound = false;
    for (const [entity] of engine.getEntitiesWith(Transform)) {
      const t = Transform.get(entity);
      if (t.parent === rootEntity && entity !== rootEntity) {
        childFound = true;
        break;
      }
    }
    expect(childFound).toBe(true);
  });

  it('should skip editor-only inspector:: components silently', () => {
    const engine = createTestEngine();

    const composite: AssetComposite = {
      version: 1,
      components: [
        {
          name: 'inspector::CustomAsset',
          data: { '0': { json: { assetId: 'some-id' } } },
        },
        {
          name: 'inspector::Config',
          data: { '0': { json: { sections: [] } } },
        },
        {
          name: 'core::GltfContainer',
          data: { '0': { json: { src: '{assetPath}/model.glb' } } },
        },
      ],
    };

    // Should not throw even though inspector:: components are present
    expect(() => spawnCustomItem(engine, composite, 'custom/item')).not.toThrow();

    const entity = spawnCustomItem(engine, composite, 'custom/item');
    // GltfContainer should exist
    const GltfContainer = engine.getComponent('core::GltfContainer') as any;
    const gltf = GltfContainer.getOrNull(entity);
    expect(gltf).not.toBeNull();
  });

  it('should call sdkHelpers.syncEntity for SyncComponents entities', () => {
    const engine = createTestEngine();
    const syncEntity = vi.fn();
    const sdkHelpers = { syncEntity };

    const composite: AssetComposite = {
      version: 1,
      components: [
        {
          name: 'core::SyncComponents',
          data: { '0': { json: { value: [] } } },
        },
      ],
    };

    spawnCustomItem(engine, composite, 'custom/sync-item', { sdkHelpers });

    expect(syncEntity).toHaveBeenCalledTimes(1);
    expect(syncEntity).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Array),
    );
  });

  it('should assign fresh IDs to Actions components (COMPONENTS_WITH_ID)', () => {
    const engine = createTestEngine();

    const actionsComponentName = ComponentName.ACTIONS;

    const composite: AssetComposite = {
      version: 1,
      components: [
        {
          name: actionsComponentName,
          data: {
            '0': {
              json: {
                id: '{self}',
                value: [
                  {
                    name: 'play_something',
                    type: 'play_animation',
                    jsonPayload: '{}',
                  },
                ],
              },
            },
          },
        },
      ],
    };

    const entity1 = spawnCustomItem(engine, composite, 'custom/actor');
    const entity2 = spawnCustomItem(engine, composite, 'custom/actor');

    // Both entities should have Actions component but with different IDs
    const Actions = engine.getComponent(actionsComponentName) as any;
    const actions1 = Actions.getOrNull(entity1);
    const actions2 = Actions.getOrNull(entity2);

    expect(actions1).not.toBeNull();
    expect(actions2).not.toBeNull();
    // IDs should be different fresh values (not the template string '{self}')
    expect(typeof actions1.id).toBe('number');
    expect(typeof actions2.id).toBe('number');
    expect(actions1.id).not.toBe(actions2.id);
  });

  it('should use default position (0,0,0) when no position specified', () => {
    const engine = createTestEngine();
    const Transform = DefineTransform(engine);

    const composite: AssetComposite = {
      version: 1,
      components: [
        {
          name: 'core::GltfContainer',
          data: { '0': { json: { src: '{assetPath}/model.glb' } } },
        },
      ],
    };

    const entity = spawnCustomItem(engine, composite, 'custom/item');
    const transform = Transform.getOrNull(entity);
    expect(transform).not.toBeNull();
    expect(transform!.position).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('should throw when composite has no entities', () => {
    const engine = createTestEngine();

    const composite: AssetComposite = {
      version: 1,
      components: [],
    };

    expect(() => spawnCustomItem(engine, composite, 'custom/empty')).toThrow(
      'No root entities found in composite',
    );
  });
});

describe('despawnCustomItem', () => {
  it('should remove the root entity', () => {
    const engine = createTestEngine();
    const Transform = DefineTransform(engine);

    const composite: AssetComposite = {
      version: 1,
      components: [
        {
          name: 'core::GltfContainer',
          data: { '0': { json: { src: '{assetPath}/model.glb' } } },
        },
      ],
    };

    const entity = spawnCustomItem(engine, composite, 'custom/item');
    expect(Transform.getOrNull(entity)).not.toBeNull();

    despawnCustomItem(engine, entity);
    // After removal, getting the component should return null
    expect(Transform.getOrNull(entity)).toBeNull();
  });

  it('should remove all entities in a multi-entity tree', () => {
    const engine = createTestEngine();
    const Transform = DefineTransform(engine);

    const composite: AssetComposite = {
      version: 1,
      components: [
        {
          name: 'core::Transform',
          data: {
            '0': { json: { position: { x: 0, y: 0, z: 0 } } },
            '1': { json: { position: { x: 1, y: 0, z: 0 }, parent: 0 } },
          },
        },
      ],
    };

    const rootEntity = spawnCustomItem(engine, composite, 'custom/tree');

    // Count entities before despawn
    const entitiesBeforeDespawn = Array.from(
      getComponentEntityTree(engine, rootEntity, Transform),
    );
    expect(entitiesBeforeDespawn.length).toBeGreaterThan(1);

    despawnCustomItem(engine, rootEntity);

    // All entities in the tree should be removed
    for (const e of entitiesBeforeDespawn) {
      expect(Transform.getOrNull(e)).toBeNull();
    }
  });
});
