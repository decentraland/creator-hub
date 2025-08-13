import { useEffect, useState } from 'react';
import type { Entity } from '@dcl/ecs';

import type { Component } from '../../lib/sdk/components';
import { useChange } from './useChange';

export const useHasComponent = (entity: Entity, component: Component) => {
  const [hasComponent, setHasComponent] = useState<boolean>(component.has(entity));

  useChange(event => {
    if (event.component?.componentId === component.componentId && event.entity === entity) {
      setHasComponent(component.has(entity));
    }
  });

  useEffect(() => {
    setHasComponent(component.has(entity));
  }, [entity, component]);

  return hasComponent;
};
