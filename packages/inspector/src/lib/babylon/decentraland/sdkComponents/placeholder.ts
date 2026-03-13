import { ComponentType } from '@dcl/ecs';

import type { ComponentOperation } from '../component-operations';
import { EcsEntity } from '../EcsEntity';
import type { SceneContext } from '../SceneContext';
import {
  loadAssetContainer,
  processGLTFAssetContainer,
  cleanupAssetContainer,
} from './gltf-container';

let sceneContext: WeakRef<SceneContext>;

type PlaceholderValue = { src: string };

export const putPlaceholderComponent: ComponentOperation = (entity, component) => {
  if (component.componentType === ComponentType.LastWriteWinElementSet) {
    const newValue = component.getOrNull(entity.entityId) as PlaceholderValue | null;
    updatePlaceholderForEntity(entity, newValue);
  }
};

function updatePlaceholderForEntity(entity: EcsEntity, newValue: PlaceholderValue | null) {
  const currentValue = entity.ecsComponentValues.placeholder;
  entity.ecsComponentValues.placeholder = newValue || undefined;

  const shouldLoad = !!newValue && currentValue?.src !== newValue?.src;
  const shouldRemove = !newValue || shouldLoad;

  if (shouldRemove) removePlaceholder(entity);
  if (shouldLoad) void loadPlaceholder(entity, newValue.src);
}

function removePlaceholder(entity: EcsEntity) {
  const context = entity.context.deref();
  if (!context) return;

  if (entity.placeholderContainer) {
    entity.placeholderContainer.setEnabled(false);
    entity.placeholderContainer.parent = null;
    entity.placeholderContainer.dispose(false, true);
    delete entity.placeholderContainer;
  }

  if (entity.placeholderAssetContainer) {
    cleanupAssetContainer(context.scene, entity.placeholderAssetContainer);
    delete entity.placeholderAssetContainer;
  }
}

async function loadPlaceholder(entity: EcsEntity, filePath: string) {
  const context = entity.context.deref();
  if (!context) return;

  if (entity.placeholderContainer) {
    removePlaceholder(entity);
  }

  if (!sceneContext) {
    sceneContext = entity.context;
  }

  const content = await context.getFile(filePath);
  if (!content) return;

  const contextStillAlive = sceneContext.deref();
  if (!contextStillAlive) return;

  const base = filePath.split('/').slice(0, -1).join('/');
  const sceneId = context.loadableScene.id;
  const finalSrc =
    filePath + '?sceneId=' + encodeURIComponent(sceneId) + '&base=' + encodeURIComponent(base);

  const file = new File([content as BlobPart], finalSrc);
  const extension = filePath.toLowerCase().endsWith('.gltf') ? '.gltf' : '.glb';

  loadAssetContainer(
    file,
    context.scene,
    assetContainer => {
      processGLTFAssetContainer(assetContainer);

      // Tag all meshes as placeholder so they are excluded from scene metrics
      for (const mesh of assetContainer.meshes) {
        mesh.metadata = { ...mesh.metadata, isPlaceholder: true };
      }

      // Remove any previous placeholder children
      const prevChildren = entity.getChildren();
      for (const child of prevChildren) {
        if (child instanceof EcsEntity || child.id.startsWith('BoundingMesh')) continue;
        // Only remove placeholder-tagged children, not gltf children
        if ((child as any).metadata?.isPlaceholder) {
          child.setEnabled(false);
          child.dispose(false, true);
        }
      }

      // Attach the root mesh to the entity
      assetContainer.meshes
        .filter($ => $.name === '__root__')
        .forEach(mesh => {
          mesh.parent = entity;
          entity.setPlaceholderContainer(mesh);
        });

      entity.setPlaceholderAssetContainer(assetContainer);

      // Intentionally do NOT call entity.generateBoundingBox()
      // Placeholder entities should not be checked for out-of-bounds
    },
    undefined,
    (_scene, message, _exception) => {
      console.error('Error loading placeholder asset: ', message, _exception);
    },
    extension,
  );
}
