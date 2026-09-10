import React, { useCallback } from 'react';
import cx from 'classnames';

import type { Entity, PBAvatarModifierArea } from '@dcl/ecs';
import { withSdk } from '../../../hoc/withSdk';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { getComponentValue, useComponentValue } from '../../../hooks/sdk/useComponentValue';
import { analytics, Event } from '../../../lib/logic/analytics';
import { getAssetByModel } from '../../../lib/logic/catalog';
import { Block } from '../../Block';
import { Button } from '../../Button';
import { Container } from '../../Container';
import { Dropdown, Label } from '../../ui';
import { InfoTooltip } from '../../ui/InfoTooltip';
import { WalletField } from '../../ui/WalletField';
import { AddButton } from '../AddButton';
import MoreOptionsMenu from '../MoreOptionsMenu';
import type { DropdownChangeEvent } from '../../ui/Dropdown/types';
import {
  MODIFIER_OPTIONS,
  addExcludeId,
  fromModifiers,
  removeExcludeId,
  toModifiers,
  updateExcludeId,
} from './utils';

import './AvatarModifierAreaInspector.css';

type Props = {
  entity: Entity;
  initialOpen?: boolean;
};

export default withSdk<Props>(({ sdk, entity, initialOpen = true }) => {
  const { AvatarModifierArea, GltfContainer } = sdk.components;
  const hasAvatarModifierArea = useHasComponent(entity, AvatarModifierArea);
  const [componentValue, setComponentValue] = useComponentValue<PBAvatarModifierArea>(
    entity,
    AvatarModifierArea,
  );

  const handleModifiersChange = useCallback(
    (event: DropdownChangeEvent) => {
      const values = event.target.value as unknown as string[];
      setComponentValue({ ...componentValue, modifiers: toModifiers(values) });
    },
    [componentValue, setComponentValue],
  );

  const handleAddExcludeId = useCallback(() => {
    setComponentValue({ ...componentValue, excludeIds: addExcludeId(componentValue.excludeIds) });
  }, [componentValue, setComponentValue]);

  const handleUpdateExcludeId = useCallback(
    (index: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setComponentValue({
        ...componentValue,
        excludeIds: updateExcludeId(componentValue.excludeIds, index, event.target.value),
      });
    },
    [componentValue, setComponentValue],
  );

  const handleRemoveExcludeId = useCallback(
    (index: number) => () => {
      setComponentValue({
        ...componentValue,
        excludeIds: removeExcludeId(componentValue.excludeIds, index),
      });
    },
    [componentValue, setComponentValue],
  );

  const handleRemove = useCallback(async () => {
    sdk.operations.removeComponent(entity, AvatarModifierArea);
    await sdk.operations.dispatch();
    const gltfContainer = getComponentValue(entity, GltfContainer);
    const asset = getAssetByModel(gltfContainer?.src);
    analytics.track(Event.REMOVE_COMPONENT, {
      componentName: 'core::AvatarModifierArea',
      itemId: asset?.id,
      itemPath: gltfContainer?.src,
    });
  }, [sdk, entity, AvatarModifierArea, GltfContainer]);

  if (!hasAvatarModifierArea) return null;

  return (
    <Container
      label="Avatar Modifier Area"
      className={cx('AvatarModifierAreaInspector')}
      initialOpen={initialOpen}
      rightContent={
        <InfoTooltip
          text="Changes how avatars behave or appear for players inside a region of the scene. The region is a 3D volume centered on the entity's position; the entity's scale sets its size and its rotation applies. Effects only apply to players inside the area, and revert when they walk out."
          link="https://docs.decentraland.org/creator/scenes-sdk7/interactivity/player-avatar#avatar-modifier-areas"
          type="help"
        />
      }
      component={AvatarModifierArea}
      entity={entity}
      onRemoveContainer={handleRemove}
    >
      <Block label="Modifiers">
        <Dropdown
          options={MODIFIER_OPTIONS}
          value={fromModifiers(componentValue.modifiers)}
          onChange={handleModifiersChange}
          multiple
          info={
            <InfoTooltip
              text={
                '"Hide Avatars" makes avatars inside the area invisible: players inside can\'t see each other, but players outside still see them. "Disable Passports" prevents clicking on an avatar to open their profile.'
              }
              type="help"
            />
          }
        />
      </Block>
      <Block className="exclude-ids">
        <div className="label-with-info">
          <Label text="Exclude Player IDs" />
          <InfoTooltip
            text="Player IDs (wallet addresses) that remain unaffected while inside the area."
            type="help"
          />
        </div>
        {(componentValue.excludeIds ?? []).map((excludeId, index) => (
          <div
            className="row"
            key={`${index}-${excludeId}`}
          >
            <WalletField
              value={excludeId}
              onChange={handleUpdateExcludeId(index)}
            />
            <MoreOptionsMenu>
              <Button onClick={handleRemoveExcludeId(index)}>Remove Player ID</Button>
            </MoreOptionsMenu>
          </div>
        ))}
        <AddButton onClick={handleAddExcludeId}>Add Player ID</AddButton>
      </Block>
    </Container>
  );
});
