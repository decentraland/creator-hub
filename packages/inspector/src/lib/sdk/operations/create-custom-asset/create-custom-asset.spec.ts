import { describe, it, expect, beforeEach } from 'vitest';
import type { Entity, IEngine, Transform as TransformEngine } from '@dcl/ecs';
import { Engine, Name as NameEngine } from '@dcl/ecs';
import * as components from '@dcl/ecs/dist/components';
import type { AssetData } from '../../../logic/catalog';
import type { EditorComponents, SdkComponents } from '../../components';
import { CoreComponents } from '../../components';
import { createComponents, createEditorComponents } from '../../components';
import { createCustomAsset } from '.';

type CustomAssetResult = { composite: AssetData['composite']; resources: string[] };

const findComponentValue = (
  result: CustomAssetResult,
  componentName: string,
  entityId: Entity,
): any => result.composite.components.find(c => c.name === componentName)?.data[entityId]?.json;

describe('createCustomAsset', () => {
  let engine: IEngine;
  let Transform: typeof TransformEngine;
  let Name: typeof NameEngine;
  let Selection: EditorComponents['Selection'];
  let Nodes: EditorComponents['Nodes'];

  beforeEach(() => {
    engine = Engine();
    Transform = components.Transform(engine);
    Name = components.Name(engine);
    const editorComponents = createEditorComponents(engine);
    Selection = editorComponents.Selection;
    Nodes = editorComponents.Nodes;

    // Initialize root node
    Nodes.create(engine.RootEntity, {
      value: [{ entity: engine.RootEntity, children: [] }],
    });
  });

  it('should create a custom asset from selected entities', () => {
    const entity1 = engine.addEntity();
    const entity2 = engine.addEntity();

    Transform.create(entity1, { position: { x: 1, y: 1, z: 1 } });
    Transform.create(entity2, { parent: entity1, position: { x: 0, y: 1, z: 0 } });
    Name.create(entity1, { value: 'Parent' });
    Name.create(entity2, { value: 'Child' });

    Selection.create(entity1);
    Selection.create(entity2);

    const createCustomAssetFn = createCustomAsset(engine);
    const result = createCustomAssetFn([entity1, entity2]);

    expect(result).toBeDefined();
    expect(result.composite).toBeDefined();
    expect(result.composite.components).toBeDefined();
    expect(result.composite.components.length).toBeGreaterThan(0);
  });

  it('should handle empty selection', () => {
    const createCustomAssetFn = createCustomAsset(engine);
    const result = createCustomAssetFn([]);

    expect(result).toBeDefined();
    expect(result.composite).toBeDefined();
    expect(result.composite.components).toEqual([]);
    expect(result.resources).toEqual([]);
  });

  it('should preserve component data in the composite', () => {
    const entity = engine.addEntity();
    Transform.create(entity, { position: { x: 1, y: 2, z: 3 } });
    Name.create(entity, { value: 'TestEntity' });
    Selection.create(entity);

    const createCustomAssetFn = createCustomAsset(engine);
    const result = createCustomAssetFn([entity]);
    const nameComponent = result.composite.components.find(
      c => c.name === NameEngine.componentName,
    );
    expect(nameComponent).toBeDefined();
    expect(nameComponent?.data[0].json.value).toEqual('TestEntity');
  });

  describe('resource path handling', () => {
    let GltfContainer: SdkComponents['GltfContainer'];
    let Material: SdkComponents['Material'];
    let Script: EditorComponents['Script'];

    beforeEach(() => {
      const sdkComponents = createComponents(engine);
      GltfContainer = sdkComponents.GltfContainer;
      Material = sdkComponents.Material;
      const editorComponents = createEditorComponents(engine);
      Script = editorComponents.Script;
    });

    describe('GltfContainer resources', () => {
      describe('when a single resource is in a subfolder', () => {
        it('should use the filename since the base path includes the subfolder', () => {
          const entity = engine.addEntity();
          Transform.create(entity, { position: { x: 0, y: 0, z: 0 } });
          GltfContainer.create(entity, { src: 'scene/assets/pack/subfolder/model.glb' });

          const createCustomAssetFn = createCustomAsset(engine);
          const result = createCustomAssetFn([entity]);

          const gltfValue = findComponentValue(result, CoreComponents.GLTF_CONTAINER, 0 as Entity);
          expect(gltfValue.src).toBe('{assetPath}/model.glb');
          expect(result.resources).toContain('scene/assets/pack/subfolder/model.glb');
        });
      });

      describe('when multiple resources are in different subfolders', () => {
        it('should preserve subfolder structure relative to the common base', () => {
          const entity1 = engine.addEntity();
          const entity2 = engine.addEntity();
          Transform.create(entity1, { position: { x: 0, y: 0, z: 0 } });
          Transform.create(entity2, { parent: entity1, position: { x: 1, y: 0, z: 0 } });
          GltfContainer.create(entity1, { src: 'scene/assets/pack/sub1/model.glb' });
          GltfContainer.create(entity2, { src: 'scene/assets/pack/sub2/texture.glb' });

          const createCustomAssetFn = createCustomAsset(engine);
          const result = createCustomAssetFn([entity1]);

          const gltf1 = findComponentValue(result, CoreComponents.GLTF_CONTAINER, 0 as Entity);
          expect(gltf1.src).toBe('{assetPath}/sub1/model.glb');

          const childEntity = (512 + 1) as Entity;
          const gltf2 = findComponentValue(result, CoreComponents.GLTF_CONTAINER, childEntity);
          expect(gltf2.src).toBe('{assetPath}/sub2/texture.glb');

          expect(result.resources).toContain('scene/assets/pack/sub1/model.glb');
          expect(result.resources).toContain('scene/assets/pack/sub2/texture.glb');
        });
      });

      describe('when multiple resources are in the same subfolder', () => {
        it('should preserve the subfolder relative to the common base', () => {
          const entity1 = engine.addEntity();
          const entity2 = engine.addEntity();
          Transform.create(entity1, { position: { x: 0, y: 0, z: 0 } });
          Transform.create(entity2, { parent: entity1, position: { x: 1, y: 0, z: 0 } });
          GltfContainer.create(entity1, { src: 'scene/assets/pack/models/a.glb' });
          GltfContainer.create(entity2, { src: 'scene/assets/pack/models/b.glb' });

          const createCustomAssetFn = createCustomAsset(engine);
          const result = createCustomAssetFn([entity1]);

          const gltf1 = findComponentValue(result, CoreComponents.GLTF_CONTAINER, 0 as Entity);
          expect(gltf1.src).toBe('{assetPath}/a.glb');

          const childEntity = (512 + 1) as Entity;
          const gltf2 = findComponentValue(result, CoreComponents.GLTF_CONTAINER, childEntity);
          expect(gltf2.src).toBe('{assetPath}/b.glb');
        });
      });

      describe('when the resource is in a flat directory', () => {
        it('should produce filename-only asset path', () => {
          const entity = engine.addEntity();
          Transform.create(entity, { position: { x: 0, y: 0, z: 0 } });
          GltfContainer.create(entity, { src: 'scene/assets/pack/model.glb' });

          const createCustomAssetFn = createCustomAsset(engine);
          const result = createCustomAssetFn([entity]);

          const gltfValue = findComponentValue(result, CoreComponents.GLTF_CONTAINER, 0 as Entity);
          expect(gltfValue.src).toBe('{assetPath}/model.glb');
          expect(result.resources).toContain('scene/assets/pack/model.glb');
        });
      });
    });

    describe('Material texture resources', () => {
      describe('when the bump texture is a single resource', () => {
        it('should produce filename-only asset path', () => {
          const entity = engine.addEntity();
          Transform.create(entity, { position: { x: 0, y: 0, z: 0 } });
          Material.create(entity, {
            material: {
              $case: 'pbr',
              pbr: {
                bumpTexture: {
                  tex: {
                    $case: 'texture',
                    texture: { src: 'scene/assets/pack/textures/bump.png' },
                  },
                },
              },
            },
          });

          const createCustomAssetFn = createCustomAsset(engine);
          const result = createCustomAssetFn([entity]);

          const materialValue = findComponentValue(result, CoreComponents.MATERIAL, 0 as Entity);
          expect(materialValue.material.pbr.bumpTexture.tex.texture.src).toBe(
            '{assetPath}/bump.png',
          );
          expect(result.resources).toContain('scene/assets/pack/textures/bump.png');
        });
      });

      describe('when the bump texture and a model are in different subfolders', () => {
        it('should preserve subfolder structure relative to the common base', () => {
          const entity = engine.addEntity();
          Transform.create(entity, { position: { x: 0, y: 0, z: 0 } });
          GltfContainer.create(entity, { src: 'scene/assets/pack/models/mesh.glb' });
          Material.create(entity, {
            material: {
              $case: 'pbr',
              pbr: {
                bumpTexture: {
                  tex: {
                    $case: 'texture',
                    texture: { src: 'scene/assets/pack/textures/bump.png' },
                  },
                },
              },
            },
          });

          const createCustomAssetFn = createCustomAsset(engine);
          const result = createCustomAssetFn([entity]);

          const gltfValue = findComponentValue(result, CoreComponents.GLTF_CONTAINER, 0 as Entity);
          expect(gltfValue.src).toBe('{assetPath}/models/mesh.glb');

          const materialValue = findComponentValue(result, CoreComponents.MATERIAL, 0 as Entity);
          expect(materialValue.material.pbr.bumpTexture.tex.texture.src).toBe(
            '{assetPath}/textures/bump.png',
          );

          expect(result.resources).toContain('scene/assets/pack/models/mesh.glb');
          expect(result.resources).toContain('scene/assets/pack/textures/bump.png');
        });
      });
    });

    describe('Script component resources', () => {
      describe('when the script is a single resource', () => {
        it('should produce filename-only asset path', () => {
          const entity = engine.addEntity();
          Transform.create(entity, { position: { x: 0, y: 0, z: 0 } });
          Script.create(entity, {
            value: [{ path: 'scene/assets/pack/scripts/main.ts', priority: 0 }],
          });

          const createCustomAssetFn = createCustomAsset(engine);
          const result = createCustomAssetFn([entity]);

          const scriptValue = findComponentValue(result, 'asset-packs::Script', 0 as Entity);
          expect(scriptValue.value[0].path).toBe('{assetPath}/main.ts');
          expect(result.resources).toContain('scene/assets/pack/scripts/main.ts');
        });
      });

      describe('when the script and a model are in different subfolders', () => {
        it('should preserve subfolder structure relative to the common base', () => {
          const entity = engine.addEntity();
          Transform.create(entity, { position: { x: 0, y: 0, z: 0 } });
          GltfContainer.create(entity, { src: 'scene/assets/pack/models/mesh.glb' });
          Script.create(entity, {
            value: [{ path: 'scene/assets/pack/scripts/main.ts', priority: 0 }],
          });

          const createCustomAssetFn = createCustomAsset(engine);
          const result = createCustomAssetFn([entity]);

          const gltfValue = findComponentValue(result, CoreComponents.GLTF_CONTAINER, 0 as Entity);
          expect(gltfValue.src).toBe('{assetPath}/models/mesh.glb');

          const scriptValue = findComponentValue(result, 'asset-packs::Script', 0 as Entity);
          expect(scriptValue.value[0].path).toBe('{assetPath}/scripts/main.ts');

          expect(result.resources).toContain('scene/assets/pack/models/mesh.glb');
          expect(result.resources).toContain('scene/assets/pack/scripts/main.ts');
        });
      });
    });
  });
});
