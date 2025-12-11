import { useEffect, useMemo, useState } from 'react';
import type { Entity } from '@dcl/ecs';

import type { Component } from '../../lib/sdk/components';
import { useChange } from './useChange';

export const useHasComponent = (entity: Entity, component: Component) => {
  const [hasComponent, setHasComponent] = useState<boolean>(component.has(entity));

  useChange(
    event => {
      if (event.entity === entity && event.component?.componentId === component.componentId) {
        setHasComponent(component.has(entity));
      }
    },
    [entity, component],
  );

  useEffect(() => {
    setHasComponent(component.has(entity));
  }, [entity, component]);

  return hasComponent;
};

export const useAllEntitiesHaveComponent = (entities: Entity[], component: Component) => {
  const [allHaveComponent, setAllHaveComponent] = useState<boolean>(() =>
    entities.every(entity => component.has(entity)),
  );

  const entitiesSet = useMemo(() => new Set(entities), [entities]);

  useChange(
    event => {
      if (event.component?.componentId === component.componentId && entitiesSet.has(event.entity)) {
        setAllHaveComponent(entities.every(entity => component.has(entity)));
      }
    },
    [entitiesSet, component],
  );

  useEffect(() => {
    setAllHaveComponent(entities.every(entity => component.has(entity)));
  }, [entities, component]);

  return allHaveComponent;
};
