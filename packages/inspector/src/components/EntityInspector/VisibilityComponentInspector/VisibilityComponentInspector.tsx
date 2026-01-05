import { useCallback } from 'react';
import type { Entity } from '@dcl/ecs';

import { withSdk } from '../../../hoc/withSdk';
import { useAllEntitiesHaveComponent } from '../../../hooks/sdk/useHasComponent';
import { useMultiComponentInput } from '../../../hooks/sdk/useComponentInput';
import { getComponentValue } from '../../../hooks/sdk/useComponentValue';
import { analytics, Event } from '../../../lib/logic/analytics';
import { getAssetByModel } from '../../../lib/logic/catalog';
import { CoreComponents } from '../../../lib/sdk/components';
import { InfoTooltip } from '../../ui/InfoTooltip';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { Dropdown } from '../../ui/Dropdown';
import { fromVisibility, toVisibility, isValidInput } from './utils';
import { type Props } from './types';

const VISIBILITY_OPTIONS = [
  { value: 'true', label: 'Visible' },
  { value: 'false', label: 'Invisible' },
];

export default withSdk<Props>(({ sdk, entities, initialOpen = true }) => {
  const { VisibilityComponent, GltfContainer } = sdk.components;

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
      </Block>
    </Container>
  );
});
