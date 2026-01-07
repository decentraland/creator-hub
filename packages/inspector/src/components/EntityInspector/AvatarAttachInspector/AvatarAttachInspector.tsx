import { useCallback } from 'react';

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
import { AvatarAnchorPointType } from '@dcl/ecs';
import { fromAvatarAttach, toAvatarAttach, isValidInput } from './utils';
import type { Props } from './types';

const ANCHOR_POINT_OPTIONS: Array<{ value: AvatarAnchorPointType; label: string }> = [
  { value: AvatarAnchorPointType.AAPT_POSITION, label: 'Avatar Position' },
  { value: AvatarAnchorPointType.AAPT_NAME_TAG, label: 'Name Tag' },
  { value: AvatarAnchorPointType.AAPT_HEAD, label: 'Head' },
  { value: AvatarAnchorPointType.AAPT_NECK, label: 'Neck' },
  { value: AvatarAnchorPointType.AAPT_SPINE, label: 'Spine' },
  { value: AvatarAnchorPointType.AAPT_SPINE1, label: 'Spine 1' },
  { value: AvatarAnchorPointType.AAPT_SPINE2, label: 'Spine 2' },
  { value: AvatarAnchorPointType.AAPT_HIP, label: 'Hip' },
  { value: AvatarAnchorPointType.AAPT_LEFT_SHOULDER, label: 'Left Shoulder' },
  { value: AvatarAnchorPointType.AAPT_LEFT_ARM, label: 'Left Arm' },
  { value: AvatarAnchorPointType.AAPT_LEFT_FOREARM, label: 'Left Forearm' },
  { value: AvatarAnchorPointType.AAPT_LEFT_HAND, label: 'Left Hand' },
  { value: AvatarAnchorPointType.AAPT_LEFT_HAND_INDEX, label: 'Left Hand Index' },
  { value: AvatarAnchorPointType.AAPT_RIGHT_SHOULDER, label: 'Right Shoulder' },
  { value: AvatarAnchorPointType.AAPT_RIGHT_ARM, label: 'Right Arm' },
  { value: AvatarAnchorPointType.AAPT_RIGHT_FOREARM, label: 'Right Forearm' },
  { value: AvatarAnchorPointType.AAPT_RIGHT_HAND, label: 'Right Hand' },
  { value: AvatarAnchorPointType.AAPT_RIGHT_HAND_INDEX, label: 'Right Hand Index' },
  { value: AvatarAnchorPointType.AAPT_LEFT_UP_LEG, label: 'Left Up Leg' },
  { value: AvatarAnchorPointType.AAPT_LEFT_LEG, label: 'Left Leg' },
  { value: AvatarAnchorPointType.AAPT_LEFT_FOOT, label: 'Left Foot' },
  { value: AvatarAnchorPointType.AAPT_LEFT_TOE_BASE, label: 'Left Toe Base' },
  { value: AvatarAnchorPointType.AAPT_RIGHT_UP_LEG, label: 'Right Up Leg' },
  { value: AvatarAnchorPointType.AAPT_RIGHT_LEG, label: 'Right Leg' },
  { value: AvatarAnchorPointType.AAPT_RIGHT_FOOT, label: 'Right Foot' },
  { value: AvatarAnchorPointType.AAPT_RIGHT_TOE_BASE, label: 'Right Toe Base' },
];

export default withSdk<Props>(({ sdk, entities, initialOpen = true }) => {
  const { AvatarAttach, GltfContainer } = sdk.components;

  const allEntitiesHaveAvatarAttach = useAllEntitiesHaveComponent(entities, AvatarAttach);

  const { getInputProps } = useMultiComponentInput(
    entities,
    AvatarAttach,
    fromAvatarAttach,
    toAvatarAttach,
    isValidInput,
  );

  const handleRemove = useCallback(async () => {
    for (const entity of entities) {
      sdk.operations.removeComponent(entity, AvatarAttach);
    }
    await sdk.operations.dispatch();
    const gltfContainer = getComponentValue(entities[0], GltfContainer);
    const asset = getAssetByModel(gltfContainer?.src);
    analytics.track(Event.REMOVE_COMPONENT, {
      componentName: CoreComponents.AVATAR_ATTACH,
      itemId: asset?.id,
      itemPath: gltfContainer?.src,
    });
  }, [sdk, entities, AvatarAttach, GltfContainer]);

  if (!allEntitiesHaveAvatarAttach) return null;

  const anchorPointId = getInputProps('anchorPointId', e => e.target.value);

  return (
    <Container
      label="AvatarAttach"
      className="AvatarAttachContainer"
      initialOpen={initialOpen}
      onRemoveContainer={handleRemove}
    >
      <Block>
        <Dropdown
          label={
            <>
              Anchor Point{' '}
              <InfoTooltip
                text="Repositions an Entity to maintain the same position and rotation relative to an avatar anchor point. Entities with this component are not rendered in the canvas. Note: The Transform component is ignored - nest the item under a parent to offset from the anchor point."
                link="https://docs.decentraland.org/creator/scenes-sdk7/3d-content-essentials/entity-positioning#attach-an-entity-to-an-avatar"
              />
            </>
          }
          options={ANCHOR_POINT_OPTIONS}
          {...anchorPointId}
        />
      </Block>
    </Container>
  );
});
