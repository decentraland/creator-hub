import { useCallback, useMemo, useState } from 'react';
import { CrdtMessageType, type Entity } from '@dcl/ecs';

import { withSdk } from '../../../hoc/withSdk';
import { useAllEntitiesHaveComponent } from '../../../hooks/sdk/useHasComponent';
import { useMultiComponentInput } from '../../../hooks/sdk/useComponentInput';
import { useChange } from '../../../hooks/sdk/useChange';
import { getComponentValue } from '../../../hooks/sdk/useComponentValue';
import { analytics, Event } from '../../../lib/logic/analytics';
import { getAssetByModel } from '../../../lib/logic/catalog';
import { CoreComponents } from '../../../lib/sdk/components';
import type { SdkContextValue } from '../../../lib/sdk/context';
import { MIXED_VALUE } from '../../ui/utils';
import { InfoTooltip } from '../../ui/InfoTooltip';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { Dropdown } from '../../ui/Dropdown';
import { COLLISION_LAYERS } from '../GltfInspector/utils';
import { fromVisibility, toVisibility, isValidInput } from './utils';
import { type Props } from './types';

const VISIBILITY_OPTIONS = [
  { value: 'true', label: 'Visible' },
  { value: 'false', label: 'Invisible' },
];

/**
 * Gets the collision mask value for an entity from either GltfContainer or MeshCollider
 */
const getEntityColliderValue = (
  entity: Entity,
  components: SdkContextValue['components'],
): number => {
  const { GltfContainer, MeshCollider } = components;
  const gltfContainer = GltfContainer.getOrNull(entity);
  const meshCollider = MeshCollider.getOrNull(entity);
  return gltfContainer?.invisibleMeshesCollisionMask ?? meshCollider?.collisionMask ?? 0;
};

export default withSdk<Props>(({ sdk, entities, initialOpen = true }) => {
  const { VisibilityComponent, GltfContainer, MeshCollider } = sdk.components;

  // Visibility component state
  const allEntitiesHaveVisibilityComponent = useAllEntitiesHaveComponent(
    entities,
    VisibilityComponent,
  );

  const { getInputProps } = useMultiComponentInput(
    entities,
    VisibilityComponent,
    fromVisibility,
    toVisibility,
    isValidInput,
  );

  // Collider state - needs manual handling since it spans GltfContainer/MeshCollider
  const [colliderUpdateCount, setColliderUpdateCount] = useState(0);

  useChange(
    event => {
      const isColliderComponent =
        event.component?.componentId === GltfContainer.componentId ||
        event.component?.componentId === MeshCollider.componentId;
      const isRelevantEntity = entities.includes(event.entity);
      const isUpdate = event.operation === CrdtMessageType.PUT_COMPONENT;

      if (isColliderComponent && isRelevantEntity && isUpdate) {
        setColliderUpdateCount(n => n + 1);
      }
    },
    [entities, GltfContainer, MeshCollider],
  );

  const colliderValue = useMemo(() => {
    const values = entities.map(entity => getEntityColliderValue(entity, sdk.components));
    const firstValue = values[0];
    const allSame = values.every(value => value === firstValue);
    return allSame ? firstValue : MIXED_VALUE;
  }, [entities, sdk.components, colliderUpdateCount]);

  // Handlers
  const handleRemove = useCallback(async () => {
    for (const entity of entities) {
      sdk.operations.removeComponent(entity, VisibilityComponent);
    }
    await sdk.operations.dispatch();

    const gltfContainer = getComponentValue(entities[0], GltfContainer);
    const asset = getAssetByModel(gltfContainer.src);
    analytics.track(Event.REMOVE_COMPONENT, {
      componentName: CoreComponents.VISIBILITY_COMPONENT,
      itemId: asset?.id,
      itemPath: gltfContainer.src,
    });
  }, [sdk, entities, VisibilityComponent, GltfContainer]);

  const handleChangeCollider = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLSelectElement>) => {
      const collisionMask = parseInt(value, 10);

      for (const entity of entities) {
        const gltfContainer = GltfContainer.getOrNull(entity);
        const meshCollider = MeshCollider.getOrNull(entity);

        if (gltfContainer) {
          sdk.operations.updateValue(GltfContainer, entity, {
            ...gltfContainer,
            invisibleMeshesCollisionMask: collisionMask,
          });
        } else if (meshCollider) {
          sdk.operations.updateValue(MeshCollider, entity, {
            ...meshCollider,
            collisionMask,
          });
        }
      }
      void sdk.operations.dispatch();
    },
    [entities, GltfContainer, MeshCollider, sdk],
  );

  if (!allEntitiesHaveVisibilityComponent) return null;

  return (
    <Container
      label="Visibility"
      className="VisibilityContainer"
      initialOpen={initialOpen}
      onRemoveContainer={handleRemove}
    >
      <Block>
        <Dropdown
          label={
            <>
              Visibility{' '}
              <InfoTooltip text="Use the Visibility property to hide an item during scene execution while keeping it visible in the editor." />
            </>
          }
          options={VISIBILITY_OPTIONS}
          {...getInputProps('visible')}
        />
        <Dropdown
          label={
            <>
              Collider{' '}
              <InfoTooltip text="Use the Collider property to turn on or off physical or clickable interaction with this item." />
            </>
          }
          options={COLLISION_LAYERS}
          value={colliderValue}
          onChange={handleChangeCollider}
        />
      </Block>
    </Container>
  );
});
