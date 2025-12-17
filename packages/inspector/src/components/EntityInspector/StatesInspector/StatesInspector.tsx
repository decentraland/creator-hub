import { useCallback } from 'react';
import cx from 'classnames';
import { ComponentName } from '@dcl/asset-packs';

import { withSdk } from '../../../hoc/withSdk';
import { useAllEntitiesHaveComponent } from '../../../hooks/sdk/useHasComponent';
import { useComponentListInput } from '../../../hooks/sdk/useComponentInput';
import { analytics, Event } from '../../../lib/logic/analytics';
import { getAssetByModel } from '../../../lib/logic/catalog';
import { allEqualTo } from '../../../lib/utils/array';
import { Block } from '../../Block';
import { Button } from '../../Button';
import { Container } from '../../Container';
import { TextField } from '../../ui/TextField';
import { InfoTooltip } from '../../ui/InfoTooltip';
import { AddButton } from '../AddButton';
import MoreOptionsMenu from '../MoreOptionsMenu';
import { getUniqueState, isRepeated, fromStates, toStates, isValidInput } from './utils';
import type { StatesInput } from './types';
import type { Props } from './types';

import './StatesInspector.css';

const NEW_STATE = 'New State';

export default withSdk<Props>(({ sdk, entities, initialOpen = true }) => {
  const { States, GltfContainer } = sdk.components;

  const allEntitiesHaveStates = useAllEntitiesHaveComponent(entities, States);

  const { items, commonItems, entityValuesMap, addItem, removeItem } = useComponentListInput<
    StatesInput,
    string
  >(entities, States, fromStates, toStates, (items: string[]) =>
    isValidInput({ value: items, defaultValue: items[0] }),
  );

  // Check if a state is the default in all entities
  const isDefaultInAllEntities = useCallback(
    (state: string): boolean => {
      return allEqualTo(entities, ent => entityValuesMap.get(ent)?.defaultValue, state);
    },
    [entities, entityValuesMap],
  );

  // Handle adding a new state to all entities
  const handleNewState = useCallback(() => {
    const allExistingStates = Array.from(entityValuesMap.values()).flatMap(s => s.value);
    const newState = getUniqueState(NEW_STATE, allExistingStates);
    addItem(newState);
  }, [entityValuesMap, addItem]);

  // Handle removing a state from all entities
  const handleRemove = useCallback(
    (state: string) => () => {
      removeItem(state);
    },
    [removeItem],
  );

  // Handle setting a state as default for all entities
  const handleDefault = useCallback(
    (state: string) => () => {
      entities.forEach(entity => {
        const currentStates = entityValuesMap.get(entity);
        if (!currentStates) return;

        sdk.operations.updateValue(States as any, entity, {
          value: currentStates.value,
          defaultValue: state,
        });
      });
      void sdk.operations.dispatch();
    },
    [entities, entityValuesMap, States, sdk.operations],
  );

  // Handle removing the States component from all entities
  const handleDelete = useCallback(async () => {
    for (const entity of entities) {
      sdk.operations.removeComponent(entity, States);
    }

    await sdk.operations.dispatch();

    // Analytics - handle case where GltfContainer might not exist
    const gltfContainer = GltfContainer.getOrNull(entities[0]);
    const asset = gltfContainer?.src ? getAssetByModel(gltfContainer?.src) : undefined;
    analytics.track(Event.REMOVE_COMPONENT, {
      componentName: ComponentName.STATES,
      itemId: asset?.id,
      itemPath: gltfContainer?.src,
    });
  }, [sdk, entities, States, GltfContainer]);

  if (!allEntitiesHaveStates) {
    return null;
  }

  // Check if a state is repeated (for validation)
  const isStateRepeated = (state: string): boolean => {
    return isRepeated(state, commonItems);
  };

  return (
    <Container
      label="States"
      className="StatesInspector"
      initialOpen={initialOpen}
      rightContent={
        <InfoTooltip
          text="States specify the status of entities. Use triggers to check or change states, and set actions accordingly."
          link="https://docs.decentraland.org/creator/smart-items/#states"
          type="help"
        />
      }
      onRemoveContainer={handleDelete}
    >
      {items.length > 0 ? (
        <Block
          label="State Name"
          className="states-list"
        >
          {items.map(({ value, isPartial, inputProps }, index) => (
            <div
              className={cx('row', { partial: isPartial })}
              key={`${isPartial ? 'partial' : 'common'}-${index}`}
            >
              <TextField
                rightLabel={
                  !isPartial && isDefaultInAllEntities(value) && !isStateRepeated(value)
                    ? 'Default'
                    : ' '
                }
                error={!isPartial && (isStateRepeated(value) || !value.trim())}
                autoSelect={!isPartial}
                debounceTime={500}
                {...inputProps}
              />
              <MoreOptionsMenu>
                <Button onClick={handleRemove(value)}>Remove State</Button>
                <Button
                  onClick={handleDefault(value)}
                  disabled={isPartial}
                >
                  Set as Default
                </Button>
              </MoreOptionsMenu>
            </div>
          ))}
        </Block>
      ) : null}
      <AddButton onClick={handleNewState}>Add New State</AddButton>
    </Container>
  );
});
