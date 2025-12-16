import { ComponentType } from '@dcl/ecs';
import type { ComponentOperation } from '../component-operations';
import { setGizmoManager, unsetGizmoManager } from './selection';

export const putHideComponent: ComponentOperation = (entity, component) => {
  const applyHideState = () => {
    const container = entity.gltfContainer ?? entity.meshRenderer;
    if (!container) return;

    if (component.componentType === ComponentType.LastWriteWinElementSet) {
      const context = entity.context.deref()!;
      const { value: isHidden } =
        (component.getOrNull(entity.entityId) as { value: boolean } | null) ?? {};
      container.setEnabled(!isHidden);
      if (isHidden) {
        unsetGizmoManager(entity);
      } else {
        const selectionValue = context.editorComponents.Selection.getOrNull(entity.entityId);
        if (selectionValue) setGizmoManager(entity, selectionValue);
      }
    }
  };

  const container = entity.gltfContainer ?? entity.meshRenderer;
  if (container) {
    applyHideState();
  } else {
    // If no container yet, wait for asset to load.
    entity.onAssetLoaded().then(applyHideState);
  }
};
