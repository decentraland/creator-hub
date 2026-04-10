import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Engine, Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import * as components from '@dcl/ecs/dist/components';
import { spawnCustomItem } from './spawn-custom-item';
import type { AssetComposite } from './types';
import { createComponents } from './definitions';

describe('spawnCustomItem', () => {
  let engine: IEngine;

  beforeEach(() => {
    engine = Engine();
    // Register core ECS components
    components.Transform(engine);
    components.GltfContainer(engine);
    components.AudioSource(engine);
    components.VideoPlayer(engine);
    components.Material(engine);
    components.Name(engine);
    // Register asset-packs components (Actions, Triggers, Counter, etc.)
    createComponents(engine);
  });

  // --- 1. Empty composite ---
  it('should return a bare entity for an empty composite', () => {
    const composite: AssetComposite = { version: 1, components: [] };
    const entity = spawnCustomItem(engine, composite);
    expect(entity).toBeDefined();
    expect(typeof entity).toBe('number');
  });

  // --- 2. Single entity with Transform ---
  it('should create an entity at the requested position', () => {
    const Transform = engine.getComponent('core::Transform') as any;
    const composite: AssetComposite = {
      version: 1,
      components: [
        {
          name: 'core::Transform',
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
      ],
    };

    const entity = spawnCustomItem(engine, composite, {
      position: { x: 5, y: 0, z: 5 },
    });

    const transform = Transform.getOrNull(entity);
    expect(transform).not.toBeNull();
    expect(transform.position.x).toBe(5);
    expect(transform.position.y).toBe(0);
    expect(transform.position.z).toBe(5);
  });

  // --- 3. GltfContainer with {assetPath} placeholder replacement ---
  it('should replace {assetPath} in GltfContainer src', () => {
    const GltfContainer = engine.getComponent('core::GltfContainer') as any;
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
            '0': { json: { src: '{assetPath}/model.glb' } },
          },
        },
      ],
    };

    const entity = spawnCustomItem(engine, composite, {
      assetPath: 'assets/custom/monster',
    });

    const gltf = GltfContainer.getOrNull(entity);
    expect(gltf).not.toBeNull();
    expect(gltf.src).toBe('assets/custom/monster/model.glb');
  });

  // --- 4. Unknown component name — should warn and skip ---
  it('should log a warning and skip unknown components without throwing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const composite: AssetComposite = {
      version: 1,
      components: [
        {
          name: 'unknown::NonExistentComponent',
          data: {
            '0': { json: { value: 42 } },
          },
        },
      ],
    };

    expect(() => spawnCustomItem(engine, composite)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unknown::NonExistentComponent'),
    );
    warnSpy.mockRestore();
  });

  // --- 5. Multi-entity tree — parent–child relationships ---
  it('should set up parent-child relationships for multi-entity composites', () => {
    const Transform = engine.getComponent('core::Transform') as any;
    // Entity 0 is root, entity 1 is child of 0
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
            '1': {
              json: {
                parent: 0,
                position: { x: 0, y: 1, z: 0 },
                rotation: { x: 0, y: 0, z: 0, w: 1 },
                scale: { x: 1, y: 1, z: 1 },
              },
            },
          },
        },
      ],
    };

    const rootEntity = spawnCustomItem(engine, composite, {
      position: { x: 10, y: 0, z: 10 },
    });

    // Root entity should have the requested position
    const rootTransform = Transform.getOrNull(rootEntity);
    expect(rootTransform).not.toBeNull();
    expect(rootTransform.position.x).toBe(10);
    expect(rootTransform.position.z).toBe(10);

    // Find child entity — it should have a parent set pointing to root
    let childFound = false;
    for (const [entity] of engine.getEntitiesWith(Transform)) {
      if (entity !== rootEntity && entity !== engine.RootEntity) {
        const childTransform = Transform.getOrNull(entity);
        if (childTransform && childTransform.parent === rootEntity) {
          childFound = true;
          expect(childTransform.position.y).toBe(1);
          break;
        }
      }
    }
    expect(childFound).toBe(true);
  });

  // --- 6. Editor-only components should be skipped ---
  it('should skip inspector:: prefixed components', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const composite: AssetComposite = {
      version: 1,
      components: [
        {
          name: 'inspector::CustomAsset',
          data: {
            '0': { json: { assetId: 'some-id' } },
          },
        },
        {
          name: 'inspector::Nodes',
          data: {
            '0': { json: { value: [] } },
          },
        },
      ],
    };

    // Should not throw and should not try to register editor components
    expect(() => spawnCustomItem(engine, composite)).not.toThrow();
    // No warnings about these — they are intentionally skipped
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  // --- 7. AudioSource {assetPath} replacement ---
  it('should replace {assetPath} in AudioSource audioClipUrl', () => {
    const AudioSource = engine.getComponent('core::AudioSource') as any;
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

    const entity = spawnCustomItem(engine, composite, {
      assetPath: 'assets/custom/door',
    });

    const audio = AudioSource.getOrNull(entity);
    expect(audio).not.toBeNull();
    expect(audio.audioClipUrl).toBe('assets/custom/door/sound.mp3');
  });
});
