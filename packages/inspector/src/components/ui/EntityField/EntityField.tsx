import React, { useMemo } from 'react';
import { BiCube as EntityIcon } from 'react-icons/bi';
import cx from 'classnames';
import { engine } from '@dcl/ecs';
import type { Entity } from '@dcl/ecs';

import { withSdk, type WithSdkProps } from '../../../hoc/withSdk';
import { useSelectedEntity } from '../../../hooks/sdk/useSelectedEntity';
import { Dropdown } from '../Dropdown';
import type { Props } from './types';

function componentHasValidValue(component: any) {
  if (component === null || component === undefined) return false;
  // Treat object-shaped component values as valid (most ECS LWW components)
  if (typeof component === 'object') return true;
  // Legacy shapes with { value: ... }
  if (typeof component.value === 'number') return component.value !== undefined;
  if (typeof component.value === 'object') {
    if (Array.isArray(component.value)) return component.value.length > 0;
    return true;
  }
  return true;
}

type EntityOption = {
  label: string;
  value: Entity;
  leftIcon: React.ReactNode;
};

const ENGINE_ENTITIES = new Set([engine.RootEntity, engine.PlayerEntity, engine.CameraEntity]);

const EntityField: React.FC<WithSdkProps & Props> = ({ sdk, ...props }) => {
  const { engine } = sdk;
  const { Name, Nodes } = sdk.components;
  const { className, components, disabled, label, value, onChange } = props;
  const selectedEntity = useSelectedEntity();

  const options: EntityOption[] = useMemo(() => {
    const uniqueEntities = new Map<Entity, EntityOption>();

    const mapEntity = (entity: Entity) => {
      uniqueEntities.set(entity, {
        label: Name.getOrNull(entity)?.value ?? entity.toString(),
        value: entity,
        leftIcon: <EntityIcon />,
      });
    };

    const reorderEntities = () => {
      const shouldOrder = selectedEntity && uniqueEntities.has(selectedEntity);

      if (!shouldOrder) return uniqueEntities;

      const orderedMap = new Map<Entity, EntityOption>();
      orderedMap.set(selectedEntity, uniqueEntities.get(selectedEntity)!);

      for (const [entity, option] of uniqueEntities.entries()) {
        if (entity === selectedEntity) continue;
        orderedMap.set(entity, option);
      }

      return orderedMap;
    };

    const providedComponents = components ?? [];
    const validComponents = providedComponents.filter(Boolean);

    if (providedComponents.length > 0) {
      // Get entities that contain any of the valid components.
      for (const component of validComponents) {
        const entities = engine.getEntitiesWith(component);
        if (!entities) continue;
        for (const [entity, _component] of entities) {
          if (
            !ENGINE_ENTITIES.has(entity) &&
            !uniqueEntities.has(entity) &&
            componentHasValidValue(_component)
          ) {
            mapEntity(entity);
          }
        }
      }
      // If there were provided components but none are valid, leave options empty.
    } else {
      // Get all entities
      const entities = Nodes.getOrNull(engine.RootEntity)?.value || [];
      for (const { entity } of entities) {
        if (!ENGINE_ENTITIES.has(entity) && !uniqueEntities.has(entity)) {
          mapEntity(entity);
        }
      }
    }
    return Array.from(reorderEntities().values());
  }, [components]);

  const emptyMessage = useMemo(() => {
    const filtered = (components ?? []).filter(Boolean) as Array<{ componentName: string }>;
    if (filtered.length > 0) {
      const componentsName = filtered.map(component => component.componentName.split('::')[1]);
      return `No entities available with ${componentsName.join(', ')}.`;
    } else {
      return 'No entities found.';
    }
  }, [components]);

  return (
    <Dropdown
      className={cx('EntityDropdown', className)}
      options={options}
      value={value}
      label={label}
      placeholder="Select Entity"
      empty={emptyMessage}
      disabled={disabled}
      searchable={true}
      onChange={onChange}
    />
  );
};

export default React.memo(withSdk(EntityField));
