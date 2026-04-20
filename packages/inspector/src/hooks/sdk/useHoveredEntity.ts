import { useEffect, useState } from 'react';
import type { Entity } from '@dcl/ecs';
import { subscribeToHoverChange } from '../../lib/babylon/setup/hover';

export function useHoveredEntity(): Entity | null {
  const [hoveredEntity, setHoveredEntity] = useState<Entity | null>(null);

  useEffect(() => {
    return subscribeToHoverChange(entityId => setHoveredEntity(entityId));
  }, []);

  return hoveredEntity;
}
