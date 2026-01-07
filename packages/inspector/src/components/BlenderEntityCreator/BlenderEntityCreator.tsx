import { useCallback, useEffect } from 'react';
import type { Entity } from '@dcl/ecs';

import { withSdk } from '../../hoc/withSdk';
import { getDataLayerInterface } from '../../redux/data-layer';

interface BlenderObjectData {
  name: string;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number; w: number };
  scale?: { x: number; y: number; z: number };
  gltfSrc?: string;
  parent?: string | null;
  isCollider?: boolean;
  entityId?: number;
  isDeleted?: boolean;
}

/**
 * Component that listens for Blender entity creation events
 * and creates the entities in the Inspector using SDK operations
 */
const BlenderEntityCreator = withSdk(({ sdk }) => {
  const cleanBlenderEntities = useCallback(
    async () => {
      try {
        console.log('[Blender Entity Creator] ========================================');
        console.log('[Blender Entity Creator] CLEAN SLATE: Deleting ALL Blender entities');
        console.log('[Blender Entity Creator] ========================================');

        // Get components
        const Name = sdk.components.Name;
        const GltfContainer = sdk.components.GltfContainer;

        let deletedCount = 0;

        // Step 1: Delete the parent "Blender" entity (if it exists)
        console.log('[Blender Entity Creator] Step 1: Looking for "Blender" parent entity...');
        let blenderParentEntity: Entity | null = null;

        for (const [entity, nameComponent] of sdk.engine.getEntitiesWith(Name)) {
          if (nameComponent.value === 'Blender') {
            blenderParentEntity = entity;
            break;
          }
        }

        if (blenderParentEntity) {
          console.log(`[Blender Entity Creator] Found "Blender" parent (${blenderParentEntity}) - DELETING...`);
          sdk.operations.removeEntity(blenderParentEntity);
          deletedCount++;
        } else {
          console.log('[Blender Entity Creator] No "Blender" parent found');
        }

        // Step 2: Delete ALL entities with GLB files from assets/blender/ (belt and suspenders approach)
        // This catches any orphaned entities that might have escaped the parent deletion
        console.log('[Blender Entity Creator] Step 2: Looking for orphaned Blender GLB entities...');
        const entitiesToDelete: Entity[] = [];
        
        for (const [entity, gltfComponent] of sdk.engine.getEntitiesWith(GltfContainer)) {
          if (gltfComponent.src && gltfComponent.src.includes('assets/blender/')) {
            entitiesToDelete.push(entity);
            console.log(`[Blender Entity Creator] Found orphaned entity with GLB: ${gltfComponent.src} - marking for deletion`);
          }
        }

        for (const entity of entitiesToDelete) {
          sdk.operations.removeEntity(entity);
          deletedCount++;
        }

        console.log(`[Blender Entity Creator] Marked ${deletedCount} total entities for deletion`);

        // Step 3: Dispatch ALL deletions at once and wait
        await sdk.operations.dispatch();
        console.log('[Blender Entity Creator] Dispatched deletions, waiting for renderer...');
        
        // Give the renderer more time to fully process all deletions
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('[Blender Entity Creator] ========================================');
        console.log('[Blender Entity Creator] Clean slate complete! All Blender entities deleted.');
        console.log('[Blender Entity Creator] ========================================');

        // Notify that cleanup is complete
        window.dispatchEvent(
          new CustomEvent('blender-entities-cleaned', {
            detail: {
              success: true,
              deletedCount: deletedCount,
              deletedFiles: [], // Files are deleted during sync, not here
            },
          }),
        );
      } catch (error: any) {
        console.error('[Blender Entity Creator] Failed to clean entities:', error);
        window.dispatchEvent(
          new CustomEvent('blender-entities-cleaned', {
            detail: {
              success: false,
              deletedCount: 0,
              deletedFiles: [],
              error: error.message || 'Unknown error',
            },
          }),
        );
      }
    },
    [sdk],
  );

  const createEntitiesFromBlender = useCallback(
    async (objects: BlenderObjectData[]) => {
      try {
        console.log('[Blender Entity Creator] ========================================');
        console.log('[Blender Entity Creator] CREATING FRESH: Starting Blender entity creation');
        console.log('[Blender Entity Creator] ========================================');
        console.log('[Blender Entity Creator] Received', objects.length, 'objects to create');

        // Filter out deleted objects and only process root objects
        // (children are embedded in parent GLBs)
        const rootObjects = objects.filter(obj => !obj.isDeleted && !obj.parent);
        
        console.log('[Blender Entity Creator] Creating', rootObjects.length, 'root entities');

        let createdCount = 0;

        // Get components
        const Name = sdk.components.Name;
        const Transform = sdk.components.Transform;
        const GltfContainer = sdk.components.GltfContainer;

        // Step 1: ALWAYS create a fresh "Blender" parent entity (should have been deleted in cleanup)
        console.log('[Blender Entity Creator] Step 1: Creating fresh "Blender" parent entity...');
        
        // Double-check it doesn't exist (it should have been deleted)
        let existingBlenderEntity: Entity | null = null;
        for (const [entity, nameComponent] of sdk.engine.getEntitiesWith(Name)) {
          if (nameComponent.value === 'Blender') {
            existingBlenderEntity = entity;
            console.warn(`[Blender Entity Creator] WARNING: Found existing "Blender" entity (${entity})! It should have been deleted. Deleting it now...`);
            sdk.operations.removeEntity(entity);
            await sdk.operations.dispatch();
            await new Promise(resolve => setTimeout(resolve, 200));
            break;
          }
        }

        // Create the parent "Blender" entity
        const blenderParentEntity = sdk.operations.addChild(sdk.engine.RootEntity, 'Blender');
        Name.createOrReplace(blenderParentEntity, { value: 'Blender' });
        
        // Set transform at origin
        Transform.createOrReplace(blenderParentEntity, {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
          parent: sdk.engine.RootEntity,
        });
        
        console.log(`[Blender Entity Creator] ✅ Created fresh "Blender" parent entity (${blenderParentEntity})`);
        
        // Dispatch to ensure parent is created before children
        await sdk.operations.dispatch();
        await new Promise(resolve => setTimeout(resolve, 100));

        // Step 2: Create all Blender objects as children of the "Blender" parent entity
        console.log('[Blender Entity Creator] Step 2: Creating child entities...');
        console.log('[Blender Entity Creator] Objects to create:', rootObjects.map(o => ({ name: o.name, gltfSrc: o.gltfSrc })));
        
        for (const obj of rootObjects) {
          try {
            // Create new entity as child of "Blender" parent entity
            const entity = sdk.operations.addChild(blenderParentEntity, obj.name);
            console.log(`[Blender Entity Creator] 📦 Creating entity "${obj.name}" (${entity}) as child of Blender parent`);

            // Set Name component
            Name.createOrReplace(entity, { value: obj.name });

            // Set transform (use provided values or defaults)
            // NOTE: Parent is set to blenderParentEntity, not RootEntity
            if (obj.position !== undefined || obj.rotation !== undefined || obj.scale !== undefined) {
              const newTransform = {
                position: obj.position ?? { x: 0, y: 0, z: 0 },
                rotation: obj.rotation ?? { x: 0, y: 0, z: 0, w: 1 },
                scale: obj.scale ?? { x: 1, y: 1, z: 1 },
                parent: blenderParentEntity,
              };

              Transform.createOrReplace(entity, newTransform);
              console.log(`[Blender Entity Creator]   ✅ Transform: pos=${JSON.stringify(newTransform.position)}`);
            } else {
              console.warn(`[Blender Entity Creator]   ⚠️ No transform data for "${obj.name}"`);
            }

            // Add GLTF container if source is provided
            if (obj.gltfSrc) {
              GltfContainer.createOrReplace(entity, {
                src: obj.gltfSrc,
                // Collision masks required for gameplay visibility
                visibleMeshesCollisionMask: 0,
                invisibleMeshesCollisionMask: 3,
              });
              console.log(`[Blender Entity Creator]   ✅ GLB: ${obj.gltfSrc}`);
            } else {
              console.warn(`[Blender Entity Creator]   ⚠️ No gltfSrc for "${obj.name}" - entity will be invisible!`);
            }

            createdCount++;
          } catch (error) {
            console.error(`[Blender Entity Creator] ❌ Failed to create entity "${obj.name}":`, error);
          }
        }

        // Dispatch the entities after creating them
        await sdk.operations.dispatch();

        console.log('[Blender Entity Creator] ========================================');
        console.log('[Blender Entity Creator] ✅ SUCCESS! Created', createdCount, 'entities');
        console.log('[Blender Entity Creator] ========================================');

        // Notify that entities were created
        window.dispatchEvent(
          new CustomEvent('blender-entities-created', {
            detail: {
              success: true,
              createdCount,
              updatedCount: 0,
              deletedCount: 0,
            },
          }),
        );
      } catch (error: any) {
        console.error('[Blender Entity Creator] Failed to create entities:', error);
        window.dispatchEvent(
          new CustomEvent('blender-entities-created', {
            detail: {
              success: false,
              createdCount: 0,
              updatedCount: 0,
              deletedCount: 0,
              error: error.message || 'Unknown error',
            },
          }),
        );
      }
    },
    [sdk],
  );

  // Listen for create-blender-entities event
  useEffect(() => {
    const handleCreateEntities = (event: CustomEvent) => {
      const { objects } = event.detail;
      if (objects && Array.isArray(objects)) {
        createEntitiesFromBlender(objects);
      }
    };

    const handleCleanEntities = () => {
      cleanBlenderEntities();
    };

    window.addEventListener('create-blender-entities', handleCreateEntities as EventListener);
    window.addEventListener('clean-blender-entities', handleCleanEntities as EventListener);

    return () => {
      window.removeEventListener('create-blender-entities', handleCreateEntities as EventListener);
      window.removeEventListener('clean-blender-entities', handleCleanEntities as EventListener);
    };
  }, [createEntitiesFromBlender, cleanBlenderEntities]);

  // This component doesn't render anything
  return null;
});

export default BlenderEntityCreator;

