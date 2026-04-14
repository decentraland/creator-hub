import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Entity, IEngine } from '@dcl/ecs';
import { Engine } from '@dcl/ecs';
import * as components from '@dcl/ecs/dist/components';
import { registerCustomItem, spawnCustomItem } from '../src/custom-item';
import type { AssetComposite } from '../src/types';
import { createComponents } from '../src/definitions';

// Silence console output during tests
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

function makeEngine(): IEngine {
  const engine = Engine();
  components.Transform(engine);
  components.Name(engine);
  components.GltfContainer(engine);
  createComponents(engine);
  return engine;
}

function singleEntityComposite(basePath = 'assets/custom/box'): AssetComposite {
  return {
    version: 1,
    components: [
      {
        name: 'core::Transform',
        data: {
          '0': { json: { position: { x: 1, y: 0, z: 1 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } } },
        },
      },
      {
        name: 'core::GltfContainer',
        data: {
          '0': { json: { src: `{assetPath}/box.glb`, visibleMeshesCollisionMask: 1, invisibleMeshesCollisionMask: 2 } },
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
        name: 'core::Transform',
        data: {
          '512': { json: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } } },
          '513': { json: { parent: 512, position: { x: 0, y: 1, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } } },
        },
      },
    ],
  };
}

function compositeWithEditorComponent(): AssetComposite {
  return {
    version: 1,
    components: [
      {
        name: 'core::Transform',
        data: {
          '0': { json: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } } },
        },
      },
      {
        name: 'inspector::CustomAsset',
        data: {
          '0': { json: { assetId: 'some-asset-id' } },
        },
      },
    ],
  };
}

describe('registerCustomItem', () => {
  it('should store the composite in the registry without error', () => {
    const composite = singleEntityComposite();
    expect(() => {
      registerCustomItem('test-id-register', composite, 'assets/custom/box');
    }).not.toThrow();
  });
});

describe('spawnCustomItem', () => {
  let engine: IEngine;

  beforeEach(() => {
    engine = makeEngine();
    // Clear any stale registry state by re-registering fresh entries per test
  });

  describe('when assetId is not registered', () => {
    it('should return null', () => {
      const result = spawnCustomItem(engine, 'non-existent-id', { x: 0, y: 0, z: 0 });
      expect(result).toBeNull();
    });

    it('should log an error', () => {
      spawnCustomItem(engine, 'non-existent-id-2', { x: 0, y: 0, z: 0 });
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('non-existent-id-2'),
      );
    });
  });

  describe('when assetId is registered with a single-entity composite', () => {
    const ASSET_ID = 'single-entity-box';
    const BASE_PATH = 'assets/custom/box';
    const POSITION = { x: 5, y: 0, z: 5 };

    beforeEach(() => {
      registerCustomItem(ASSET_ID, singleEntityComposite(BASE_PATH), BASE_PATH);
    });

    it('should return an entity', () => {
      const entity = spawnCustomItem(engine, ASSET_ID, POSITION);
      expect(entity).not.toBeNull();
      expect(typeof entity).toBe('number');
    });

    it('should place the root entity at the requested position', () => {
      const Transform = engine.getComponent('core::Transform') as any;
      const entity = spawnCustomItem(engine, ASSET_ID, POSITION) as Entity;
      const transform = Transform.getOrNull(entity);
      expect(transform).not.toBeNull();
      expect(transform!.position).toMatchObject(POSITION);
    });

    it('should resolve {assetPath} placeholders in GltfContainer.src', () => {
      const GltfContainer = engine.getComponent('core::GltfContainer') as any;
      const entity = spawnCustomItem(engine, ASSET_ID, POSITION) as Entity;
      const gltf = GltfContainer.getOrNull(entity);
      expect(gltf).not.toBeNull();
      expect(gltf!.src).toBe(`${BASE_PATH}/box.glb`);
      expect(gltf!.src).not.toContain('{assetPath}');
    });
  });

  describe('when the composite has a parent-child entity hierarchy', () => {
    const ASSET_ID = 'multi-entity-item';
    const POSITION = { x: 0, y: 0, z: 0 };

    beforeEach(() => {
      registerCustomItem(ASSET_ID, multiEntityComposite(), 'assets/custom/multi');
    });

    it('should return a non-null root entity', () => {
      const entity = spawnCustomItem(engine, ASSET_ID, POSITION);
      expect(entity).not.toBeNull();
    });

    it('should create multiple entities for the tree', () => {
      const Transform = engine.getComponent('core::Transform') as any;
      const entityCountBefore = Array.from(engine.componentsIter())
        .filter(c => c.componentId === Transform.componentId)
        .length;

      spawnCustomItem(engine, ASSET_ID, POSITION);

      // Each entity in a composite should produce a Transform
      // Engine entity iteration: count transform-bearing entities
      let entityCount = 0;
      for (const [_entity] of engine.getEntitiesWith(Transform)) {
        entityCount++;
      }
      expect(entityCount).toBeGreaterThan(entityCountBefore);
    });
  });

  describe('when the composite contains editor-only components', () => {
    const ASSET_ID = 'item-with-editor-components';

    beforeEach(() => {
      registerCustomItem(ASSET_ID, compositeWithEditorComponent(), 'assets/custom/editortest');
    });

    it('should spawn without error', () => {
      expect(() => {
        spawnCustomItem(engine, ASSET_ID, { x: 0, y: 0, z: 0 });
      }).not.toThrow();
    });

    it('should return a valid entity', () => {
      const entity = spawnCustomItem(engine, ASSET_ID, { x: 0, y: 0, z: 0 });
      expect(entity).not.toBeNull();
    });
  });
});
