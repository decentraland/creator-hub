import { ComponentType } from '@dcl/ecs';
import type { ComponentOperation } from '../component-operations';
import { setGizmoManager, unsetGizmoManager } from '../editorComponents/selection';

/**
 * Component operation for AvatarAttach component.
 * Hides entities with AvatarAttach from the canvas since they are attached to avatars
 * and their Transform is overridden by the component.
 */
export const putAvatarAttachComponent: ComponentOperation = (entity, component) => {
  // Ensure asset is loaded before applying hide.
  entity.onAssetLoaded().then(() => {
    const container = entity.gltfContainer ?? entity.meshRenderer;
    if (!container) return;

    if (component.componentType === ComponentType.LastWriteWinElementSet) {
      const context = entity.context.deref()!;
      const avatarAttach = component.getOrNull(entity.entityId);
      const hasAvatarAttach = avatarAttach !== null;

      // Hide the entity in the canvas when it has AvatarAttach
      container.setEnabled(!hasAvatarAttach);

      if (hasAvatarAttach) {
        // Unset gizmo manager when hidden
        unsetGizmoManager(entity);
      } else {
        // Restore gizmo manager if component is removed
        const selectionValue = context.editorComponents.Selection.getOrNull(entity.entityId);
        if (selectionValue) setGizmoManager(entity, selectionValue);
      }
    }
  });
};
