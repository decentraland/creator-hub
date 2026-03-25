import { useCallback, useEffect } from 'react';

import type { Material } from '@babylonjs/core';
import { MultiMaterial } from '@babylonjs/core';
import { CrdtMessageType } from '@dcl/ecs';

import { withSdk } from '../../../hoc/withSdk';
import { useChange } from '../../../hooks/sdk/useChange';
import { getLayoutManager } from '../../../lib/babylon/decentraland/layout-manager';
import { GROUND_MESH_PREFIX } from '../../../lib/utils/scene';
import { useAppDispatch } from '../../../redux/hooks';
import { setEntitiesOutOfBoundaries, setMetrics, setLimits } from '../../../redux/scene-metrics';
import { collectTexturesFromMaterial, getSceneLimits } from './utils';

const IGNORE_MATERIALS = [
  // Babylon default materials
  'BackgroundSkyboxMaterial',
  'BackgroundPlaneMaterial',
  'colorShader',
  'colorShaderOccQuery',
  'skyBox',
  // Utils Materials
  'entity_outside_layout',
  'entity_outside_layout_multimaterial',
  'layout_grid',
  'grid',
  'base-box',
  'collider-material',
  '__GLTFLoader._default',
];
const IGNORE_TEXTURES = [
  // Babylon default textures
  'https://assets.babylonjs.com/environments/backgroundGround.png',
  'https://assets.babylonjs.com/environments/backgroundSkybox.dds',
  'https://assets.babylonjs.com/environments/environmentSpecular.env',
  'EffectLayerMainRTT',
  'HighlightLayerBlurRTT',
  'data:EnvironmentBRDFTexture0',
  // Utils Textures
  'GlowLayerBlurRTT',
  'GlowLayerBlurRTT2',
];
const IGNORE_MESHES = [
  'BackgroundHelper',
  'BackgroundPlane',
  'BackgroundSkybox',
  // Editor environment meshes from createDefaultEnvironment
  'ground',
  'skybox',
  '__root__',
  // Axis indicator meshes from layout manager
  'axis_x_line',
  'axis_y_line',
  'axis_z_line',
  'z_cone_axis',
];

const Metrics = withSdk(({ sdk }) => {
  const ROOT = sdk.engine.RootEntity;
  const PLAYER_ROOT = sdk.engine.PlayerEntity;
  const CAMERA_ROOT = sdk.engine.CameraEntity;
  const dispatch = useAppDispatch();

  const getNodes = useCallback(
    () =>
      sdk.components.Nodes.getOrNull(ROOT)?.value.filter(
        node => ![ROOT, PLAYER_ROOT, CAMERA_ROOT].includes(node.entity),
      ) ?? [],
    [sdk],
  );

  const handleUpdateMetrics = useCallback(() => {
    const meshes = sdk.scene.meshes.filter(
      mesh =>
        !IGNORE_MESHES.includes(mesh.id) &&
        !mesh.id.startsWith(GROUND_MESH_PREFIX) &&
        !mesh.id.startsWith('BoundingMesh') &&
        !mesh.id.startsWith('axis_') && // Exclude all axis indicator meshes
        !mesh.id.startsWith('axisHelper') && // Exclude axis helper meshes
        !mesh.metadata?.isPlaceholder && // Exclude placeholder meshes (editor-only visualization)
        !mesh.id.startsWith('spawn_point_'), // Exclude spawn point visual meshes
    );
    // Calculate triangle count correctly: getTotalIndices() / 3
    // If a mesh doesn't have indices, it might be using vertices directly, so we fall back to vertices / 3
    const triangles = meshes.reduce((acc, mesh) => {
      const indices = mesh.getTotalIndices();
      if (indices > 0) {
        return acc + indices / 3;
      }
      // Fallback for meshes without indices (shouldn't happen for proper meshes, but safe fallback)
      const vertices = mesh.getTotalVertices();
      return acc + Math.floor(vertices / 3);
    }, 0);

    // Collect materials and textures only from user-created meshes (not editor meshes)
    // This ensures we don't count editor-only materials/textures
    const materialsFromMeshes = new Set<string>();
    const texturesFromMaterials = new Set<string>();

    meshes.forEach(mesh => {
      // Handle multi-material meshes
      if (mesh.material instanceof MultiMaterial) {
        const multiMaterial = mesh.material;
        multiMaterial.subMaterials.forEach((subMaterial: Material | null) => {
          if (subMaterial) {
            const materialId = subMaterial.id;
            if (!IGNORE_MATERIALS.includes(materialId)) {
              materialsFromMeshes.add(materialId);
              collectTexturesFromMaterial(subMaterial, texturesFromMaterials, IGNORE_TEXTURES);
            }
          }
        });
      } else if (mesh.material) {
        // Collect materials from this mesh
        const materialId = mesh.material.id;
        if (!IGNORE_MATERIALS.includes(materialId)) {
          materialsFromMeshes.add(materialId);
          collectTexturesFromMaterial(mesh.material, texturesFromMaterials, IGNORE_TEXTURES);
        }
      }
    });

    dispatch(
      setMetrics({
        triangles,
        entities: getNodes().length,
        bodies: meshes.length,
        materials: materialsFromMeshes.size,
        textures: texturesFromMaterials.size,
      }),
    );
  }, [sdk, dispatch, getNodes, setMetrics]);

  const handleUpdateSceneLayout = useCallback(() => {
    const scene = sdk.components.Scene.getOrNull(ROOT);
    if (scene) {
      dispatch(setLimits(getSceneLimits(scene.layout.parcels.length)));
    }
  }, [sdk, dispatch]);

  const handleSceneChange = useCallback(() => {
    const nodes = getNodes();
    const { isEntityOutsideLayout } = getLayoutManager(sdk.scene);

    const entitiesOutOfBoundariesArray: number[] = [];

    nodes.forEach(node => {
      const entity = sdk.sceneContext.getEntityOrNull(node.entity);
      if (entity && entity.boundingInfoMesh) {
        const isOutside = isEntityOutsideLayout(entity.boundingInfoMesh);
        if (isOutside) {
          entitiesOutOfBoundariesArray.push(node.entity);
        }
      }
    });

    dispatch(setEntitiesOutOfBoundaries(entitiesOutOfBoundariesArray));
  }, [sdk, dispatch, getNodes, setEntitiesOutOfBoundaries]);

  useEffect(() => {
    const handleOutsideMaterialChange = (material: Material) => {
      if (material.name === 'entity_outside_layout_multimaterial') {
        handleSceneChange();
      }
    };

    const addOutsideMaterialObservable = sdk.scene.onNewMultiMaterialAddedObservable.add(
      handleOutsideMaterialChange,
    );
    const removeOutsideMaterialObservable = sdk.scene.onMaterialRemovedObservable.add(
      handleOutsideMaterialChange,
    );

    sdk.scene.onDataLoadedObservable.add(handleUpdateMetrics);
    sdk.scene.onMeshRemovedObservable.add(handleUpdateMetrics);

    handleUpdateSceneLayout();

    return () => {
      sdk.scene.onDataLoadedObservable.removeCallback(handleUpdateMetrics);
      sdk.scene.onMeshRemovedObservable.removeCallback(handleUpdateMetrics);
      sdk.scene.onNewMultiMaterialAddedObservable.remove(addOutsideMaterialObservable);
      sdk.scene.onMaterialRemovedObservable.remove(removeOutsideMaterialObservable);
    };
  }, []);

  useChange(
    ({ operation, component }) => {
      if (
        operation === CrdtMessageType.PUT_COMPONENT &&
        component?.componentId === sdk.components.Scene.componentId
      ) {
        handleUpdateSceneLayout();
      }
    },
    [handleUpdateSceneLayout],
  );

  return null;
});

export default Metrics;
