import { useEffect, useState } from 'react';
import type { AnimationGroup } from '@babylonjs/core';
import type { Entity } from '@dcl/ecs';

import { useSdk } from './useSdk';
import { useComponentValue } from './useComponentValue';

/**
 * Hook to load animation groups from a GLTF container.
 * Returns an array of AnimationGroup objects available in the entity's GLTF.
 *
 * @param entityId - The entity ID to load animations from
 * @returns Array of AnimationGroup objects (empty if no GLTF or no animations)
 */
export const useGltfAnimations = (entityId: Entity): AnimationGroup[] => {
  const sdk = useSdk();
  const GltfContainer = sdk?.components.GltfContainer;

  const [gltfValue] = useComponentValue(entityId, GltfContainer!);
  const [animations, setAnimations] = useState<AnimationGroup[]>([]);

  useEffect(() => {
    if (!sdk || !gltfValue?.src) {
      setAnimations([]);
      return;
    }

    const entity = sdk.sceneContext.getEntityOrNull(entityId);
    if (!entity) {
      setAnimations([]);
      return;
    }

    const loadAnimations = async () => {
      try {
        const { animationGroups } = await entity.onGltfContainerLoaded();
        setAnimations([...animationGroups]);
      } catch {
        setAnimations([]);
      }
    };

    void loadAnimations();
  }, [entityId, gltfValue?.src, sdk]);

  return animations;
};
