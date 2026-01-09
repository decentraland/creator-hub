import { useCallback, useState, useEffect } from 'react';
import { BiExport } from 'react-icons/bi';

import { withSdk } from '../../../hoc/withSdk';
import { ToolbarButton } from '../ToolbarButton';
import { getSceneClient } from '../../../lib/rpc/scene';
import type { Entity } from '@dcl/ecs';

const ExportGltf = withSdk(({ sdk }) => {
  const [isExporting, setIsExporting] = useState(false);

  const performExport = useCallback(async () => {
    if (isExporting) return;

    setIsExporting(true);
    console.log('[Export GLTF] Starting export...');

    try {
      // Collect all entities with Transform and GltfContainer components
      const entities: any[] = [];

      // Get all entities that have Transform component
      const transformedEntities = Array.from(sdk.engine.getEntitiesWith(sdk.components.Transform));

      console.log('[Export GLTF] Found', transformedEntities.length, 'entities with Transform');

      for (const [entity] of transformedEntities) {
        // Skip special entities (Root, Player, Camera)
        if (
          entity === sdk.engine.RootEntity ||
          entity === sdk.engine.PlayerEntity ||
          entity === sdk.engine.CameraEntity
        ) {
          continue;
        }

        const transform = sdk.components.Transform.get(entity);
        const gltfContainer = sdk.components.GltfContainer.getOrNull(entity);
        const name = sdk.components.Name.getOrNull(entity);

        // Only include entities that have a GLTF model
        if (!gltfContainer || !gltfContainer.src) {
          continue;
        }

        const entityData = {
          entityId: entity,
          gltfSrc: gltfContainer.src,
          name: name?.value || `Entity_${entity}`,
          transform: transform
            ? {
                position: transform.position
                  ? { x: transform.position.x, y: transform.position.y, z: transform.position.z }
                  : undefined,
                rotation: transform.rotation
                  ? {
                      x: transform.rotation.x,
                      y: transform.rotation.y,
                      z: transform.rotation.z,
                      w: transform.rotation.w,
                    }
                  : undefined,
                scale: transform.scale
                  ? { x: transform.scale.x, y: transform.scale.y, z: transform.scale.z }
                  : undefined,
              }
            : undefined,
        };

        entities.push(entityData);
      }

      console.log('[Export GLTF] Collected', entities.length, 'entities with GLTF models');

      if (entities.length === 0) {
        console.warn('[Export GLTF] No GLTF models found in scene');
        const sceneClient = getSceneClient();
        if (sceneClient) {
          await sceneClient.request('push_notification', {
            notification: {
              severity: 'warning',
              message: 'No 3D models found in the scene to export.',
            },
          });
        }
        return;
      }

      // Send entities to Creator Hub for export
      const sceneClient = getSceneClient();
      if (sceneClient) {
        console.log('[Export GLTF] Sending export request to Creator Hub...');
        const result = await sceneClient.request('export_scene_gltf', { entities });
        console.log('[Export GLTF] Export result:', result);
      } else {
        console.error('[Export GLTF] No scene client available');
      }
    } catch (error) {
      console.error('[Export GLTF] Export failed:', error);
      const sceneClient = getSceneClient();
      if (sceneClient) {
        await sceneClient.request('push_notification', {
          notification: {
            severity: 'error',
            message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        });
      }
    } finally {
      setIsExporting(false);
    }
  }, [sdk, isExporting]);

  // Listen for export trigger from Creator Hub
  useEffect(() => {
    const handleTriggerExport = () => {
      performExport();
    };

    window.addEventListener('trigger-export-scene', handleTriggerExport);

    return () => {
      window.removeEventListener('trigger-export-scene', handleTriggerExport);
    };
  }, [performExport]);

  const handleExport = useCallback(() => {
    performExport();
  }, [performExport]);

  return (
    <ToolbarButton
      className="export-gltf"
      onClick={handleExport}
      disabled={isExporting}
      title={isExporting ? 'Exporting scene...' : 'Export scene as GLTF'}
    >
      <BiExport />
    </ToolbarButton>
  );
});

export default ExportGltf;

