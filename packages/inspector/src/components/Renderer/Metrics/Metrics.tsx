import React, { useCallback, useEffect, useMemo } from 'react';
import { FiAlertTriangle as WarningIcon } from 'react-icons/fi';
import { IoGridOutline as SquaresGridIcon } from 'react-icons/io5';
import cx from 'classnames';

import type { Material } from '@babylonjs/core';
import { Texture, MultiMaterial } from '@babylonjs/core';
import { CrdtMessageType } from '@dcl/ecs';

import type { WithSdkProps } from '../../../hoc/withSdk';
import { withSdk } from '../../../hoc/withSdk';
import { useChange } from '../../../hooks/sdk/useChange';
import { useOutsideClick } from '../../../hooks/useOutsideClick';
import { getLayoutManager } from '../../../lib/babylon/decentraland/layout-manager';
import type { Layout } from '../../../lib/utils/layout';
import { GROUND_MESH_PREFIX, PARCEL_SIZE } from '../../../lib/utils/scene';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import {
  getMetrics,
  getLimits,
  getEntitiesOutOfBoundaries,
  getHasCustomCode,
  setEntitiesOutOfBoundaries,
  setMetrics,
  setLimits,
} from '../../../redux/scene-metrics';
import type { SceneMetrics } from '../../../redux/scene-metrics/types';
import { Button } from '../../Button';
import { collectTexturesFromMaterial, getSceneLimits } from './utils';

import './Metrics.css';

const ICON_SIZE = 18;
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

const Metrics = withSdk<WithSdkProps>(({ sdk }) => {
  const ROOT = sdk.engine.RootEntity;
  const PLAYER_ROOT = sdk.engine.PlayerEntity;
  const CAMERA_ROOT = sdk.engine.CameraEntity;
  const dispatch = useAppDispatch();
  const metrics = useAppSelector(getMetrics);
  const limits = useAppSelector(getLimits);
  const entitiesOutOfBoundaries = useAppSelector(getEntitiesOutOfBoundaries);
  const hasCustomCode = useAppSelector(getHasCustomCode);
  const [showMetrics, setShowMetrics] = React.useState(false);
  const [sceneLayout, setSceneLayout] = React.useState<Layout>({
    base: { x: 0, y: 0 },
    parcels: [],
  });

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
        !mesh.metadata?.isPlaceholder, // Exclude placeholder meshes (editor-only visualization)
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
      setSceneLayout(scene.layout as Layout);
      dispatch(setLimits(getSceneLimits(scene.layout.parcels.length)));
    }
  }, [sdk, setSceneLayout]);

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

  const limitsExceeded = useMemo<Record<string, boolean>>(() => {
    return Object.fromEntries(
      Object.entries(metrics)
        .map(([key, value]) => [key, value > limits[key as keyof SceneMetrics]])
        .filter(([, value]) => value),
    );
  }, [metrics, limits]);

  const isAnyLimitExceeded = (limitsExceeded: Record<string, any>): boolean => {
    return (
      Object.values(limitsExceeded).length > 0 ||
      entitiesOutOfBoundaries.length > 0 ||
      hasCustomCode
    );
  };

  const handleToggleMetricsOverlay = useCallback(
    (e: React.MouseEvent<HTMLButtonElement> | MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setShowMetrics(value => !value);
    },
    [showMetrics, setShowMetrics],
  );

  const overlayRef = useOutsideClick(handleToggleMetricsOverlay);

  const getWarningMessages = (): string[] => {
    const baseMessage = 'Your scene contains too many';
    const warnings: string[] = [];

    Object.entries(limitsExceeded).forEach(([key, isExceeded]) => {
      if (isExceeded) {
        warnings.push(`${baseMessage} ${key}`);
      }
    });

    if (entitiesOutOfBoundaries.length > 0) {
      warnings.push(
        `${entitiesOutOfBoundaries.length} entit${
          entitiesOutOfBoundaries.length === 1 ? 'y is' : 'ies are'
        } out of bounds and may not display correctly in-world.`,
      );
    }

    if (hasCustomCode) {
      warnings.push(
        'This scene includes code elements that may only become visible once the scene is running.',
      );
    }

    return warnings;
  };

  const warningMessages = getWarningMessages();

  return (
    <div className="Metrics">
      <div className="Buttons">
        <Button
          className={cx({ Active: showMetrics, LimitExceeded: isAnyLimitExceeded(limitsExceeded) })}
          onClick={handleToggleMetricsOverlay}
        >
          <SquaresGridIcon size={ICON_SIZE} />
          {isAnyLimitExceeded(limitsExceeded) && <span className="WarningDot" />}
        </Button>
      </div>
      {showMetrics && (
        <div
          ref={overlayRef}
          className="Overlay"
        >
          <h2 className="Header">Scene Optimization</h2>
          <div className="Description">Suggested Specs per Parcel</div>
          <div className="Description">
            {sceneLayout.parcels.length} Parcels = {sceneLayout.parcels.length * PARCEL_SIZE}
            <div>
              m<sup>2</sup>
            </div>
          </div>
          <div className="Items">
            {Object.entries(metrics).map(([key, value]) => (
              <div
                className="Item"
                key={key}
              >
                <div className="Title">{key.toUpperCase()}</div>
                <div className={cx('Description', { LimitExceeded: limitsExceeded[key] })}>
                  <span className="primary">{value}</span>
                  {'/'}
                  <span className="secondary">{limits[key as keyof SceneMetrics]}</span>
                </div>
              </div>
            ))}
          </div>
          {warningMessages.length > 0 && (
            <div className="WarningsContainer">
              <div className="Description">WARNINGS</div>
              {warningMessages.map((message, index) => (
                <div
                  className="WarningItem"
                  key={index}
                >
                  <WarningIcon className="WarningIcon" />
                  <span className="WarningText">{message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default React.memo(Metrics);
