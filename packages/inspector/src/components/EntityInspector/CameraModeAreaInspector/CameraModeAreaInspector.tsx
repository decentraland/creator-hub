import { useCallback } from 'react';
import cx from 'classnames';

import type { Entity } from '@dcl/ecs';
import { withSdk } from '../../../hoc/withSdk';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { getComponentValue } from '../../../hooks/sdk/useComponentValue';
import { useComponentInput } from '../../../hooks/sdk/useComponentInput';
import { analytics, Event } from '../../../lib/logic/analytics';
import { getAssetByModel } from '../../../lib/logic/catalog';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { Dropdown } from '../../ui';
import { InfoTooltip } from '../../ui/InfoTooltip';
import { MODE_OPTIONS, fromCameraModeArea, toCameraModeArea } from './utils';

type Props = {
  entity: Entity;
  initialOpen?: boolean;
};

export default withSdk<Props>(({ sdk, entity, initialOpen = true }) => {
  const { CameraModeArea, GltfContainer } = sdk.components;
  const hasCameraModeArea = useHasComponent(entity, CameraModeArea);

  const { getInputProps } = useComponentInput(
    entity,
    CameraModeArea,
    fromCameraModeArea,
    toCameraModeArea,
  );

  const modeProps = getInputProps('mode');

  const handleRemove = useCallback(async () => {
    sdk.operations.removeComponent(entity, CameraModeArea);
    await sdk.operations.dispatch();
    const gltfContainer = getComponentValue(entity, GltfContainer);
    const asset = getAssetByModel(gltfContainer?.src);
    analytics.track(Event.REMOVE_COMPONENT, {
      componentName: 'core::CameraModeArea',
      itemId: asset?.id,
      itemPath: gltfContainer?.src,
    });
  }, [sdk, entity, CameraModeArea, GltfContainer]);

  if (!hasCameraModeArea) return null;

  return (
    <Container
      label="Camera Modifier Area"
      className={cx('CameraModeAreaInspector')}
      initialOpen={initialOpen}
      rightContent={
        <InfoTooltip
          text="Forces the player's camera mode inside a region of the scene. The region is a 3D volume centered on the entity's position; the entity's scale sets its size and its rotation applies. The player's previous camera mode is restored when they walk out."
          link="https://docs.decentraland.org/creator/scenes-sdk7/3d-content-essentials/camera#1st-and-3rd-person-camera-modes"
          type="help"
        />
      }
      component={CameraModeArea}
      entity={entity}
      onRemoveContainer={handleRemove}
    >
      <Block label="Camera Mode">
        <Dropdown
          options={MODE_OPTIONS}
          {...modeProps}
          info={
            <InfoTooltip
              text="The camera mode enforced while the player is inside the area. Players can't switch modes until they leave, and their previous setting is then restored."
              type="help"
            />
          }
        />
      </Block>
    </Container>
  );
});
