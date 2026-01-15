import { useEffect } from 'react';
import type { Entity } from '@dcl/ecs';

import { withSdk } from '../../hoc/withSdk';

/**
 * Component that listens for collect-scene-entities event
 * and collects entity data from the scene for Blender sync
 */
const EntityCollector = withSdk(({ sdk }) => {
  useEffect(() => {
    const handleCollectEntities = async () => {
      try {
        console.log('[Entity Collector] Collecting entities...');
        
        const entities: Array<{
          entityId: number;
          name?: string;
          gltfSrc?: string;
          transform?: {
            position?: { x: number; y: number; z: number };
            rotation?: { x: number; y: number; z: number; w: number };
            scale?: { x: number; y: number; z: number };
          };
        }> = [];

        // Get components
        const Name = sdk.components.Name;
        const Transform = sdk.components.Transform;
        const GltfContainer = sdk.components.GltfContainer;

        // Collect entities with Name components (primary matching method)
        const entitiesWithName = Array.from(sdk.engine.getEntitiesWith(Name));
        console.log('[Entity Collector] Found', entitiesWithName.length, 'entities with Name component');

        // Also collect entities with GLTF containers (for fallback matching by GLTF filename)
        const entitiesWithGltf = Array.from(sdk.engine.getEntitiesWith(GltfContainer));
        console.log('[Entity Collector] Found', entitiesWithGltf.length, 'entities with GltfContainer');

        const processedEntities = new Set<number>();

        // First, process entities with Name components
        for (const [entity, nameComponent] of entitiesWithName) {
          const name = nameComponent.value;
          
          // Get transform if it exists
          const transform = Transform.getOrNull(entity);
          
          // Get GLTF container if it exists
          const gltf = GltfContainer.getOrNull(entity);

          if (!name) {
            console.warn('[Entity Collector] Entity with Name component but no name value:', entity);
            continue;
          }

          processedEntities.add(entity as number);
          entities.push({
            entityId: entity as number,
            name: name,
            gltfSrc: gltf?.src,
            transform: transform
              ? {
                  position: transform.position,
                  rotation: transform.rotation,
                  scale: transform.scale,
                }
              : undefined,
          });
        }

        // Also collect entities with GLTF containers that don't have names
        // (we can match these by GLTF filename)
        for (const [entity, gltf] of entitiesWithGltf) {
          if (processedEntities.has(entity as number)) {
            continue; // Already processed
          }

          // Extract object name from GLTF path (e.g., "assets/blender/ObjectName.glb" -> "ObjectName")
          const gltfPath = gltf.src;
          let inferredName: string | undefined;
          
          if (gltfPath) {
            // Extract filename from path and remove extension
            const filename = gltfPath.split('/').pop() || '';
            inferredName = filename.replace(/\.(glb|gltf)$/i, '');
          }

          const transform = Transform.getOrNull(entity);
          const nameComponent = Name.getOrNull(entity);

          entities.push({
            entityId: entity as number,
            name: nameComponent?.value || inferredName,
            gltfSrc: gltfPath,
            transform: transform
              ? {
                  position: transform.position,
                  rotation: transform.rotation,
                  scale: transform.scale,
                }
              : undefined,
          });
        }

        console.log('[Entity Collector] Collected', entities.length, 'entities:', entities.map(e => ({ name: e.name, entityId: e.entityId, hasTransform: !!e.transform })));

        // Send entities back via event
        window.dispatchEvent(
          new CustomEvent('scene-entities-collected', {
            detail: { entities },
          }),
        );
      } catch (error) {
        console.error('[Entity Collector] Error collecting entities:', error);
        // Still dispatch empty array on error
        window.dispatchEvent(
          new CustomEvent('scene-entities-collected', {
            detail: { entities: [] },
          }),
        );
      }
    };

    window.addEventListener('collect-scene-entities', handleCollectEntities as EventListener);
    console.log('[Entity Collector] Registered event listener');

    return () => {
      window.removeEventListener('collect-scene-entities', handleCollectEntities as EventListener);
    };
  }, [sdk]);

  // This component doesn't render anything
  return null;
});

export default EntityCollector;

