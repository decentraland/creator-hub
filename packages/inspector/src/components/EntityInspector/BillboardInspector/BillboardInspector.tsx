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
import { BillboardMode } from '@dcl/ecs';
import { fromBillboard, toBillboard, isValidInput } from './utils';
import type { Props } from './types';

const BILLBOARD_MODE_OPTIONS = [
  { value: BillboardMode.BM_NONE.toString(), label: 'None' },
  { value: BillboardMode.BM_X.toString(), label: 'X Axis' },
  { value: BillboardMode.BM_Y.toString(), label: 'Y Axis' },
  { value: BillboardMode.BM_Z.toString(), label: 'Z Axis' },
  { value: BillboardMode.BM_ALL.toString(), label: 'All' },
];

export default withSdk<Props>(({ sdk, entities, initialOpen = true }) => {
  const { Billboard, GltfContainer } = sdk.components;

  const allEntitiesHaveBillboard = useAllEntitiesHaveComponent(entities, Billboard);

  const { getInputProps } = useMultiComponentInput(
    entities,
    Billboard,
    fromBillboard,
    toBillboard,
    isValidInput,
  );

  const handleRemove = useCallback(async () => {
    for (const entity of entities) {
      sdk.operations.removeComponent(entity, Billboard);
    }
    await sdk.operations.dispatch();
    const gltfContainer = getComponentValue(entities[0], GltfContainer);
    const asset = getAssetByModel(gltfContainer?.src);
    analytics.track(Event.REMOVE_COMPONENT, {
      componentName: CoreComponents.BILLBOARD,
      itemId: asset?.id,
      itemPath: gltfContainer?.src,
    });
  }, [sdk, entities, Billboard, GltfContainer]);

  if (!allEntitiesHaveBillboard) return null;

  const billboardMode = getInputProps('billboardMode', e => e.target.value);

  return (
    <Container
      label="Billboard"
      className="BillboardContainer"
      initialOpen={initialOpen}
      rightContent={
        <InfoTooltip
          text="Make an entity automatically reorient its rotation to always face the camera, as in retro 3D games that used 2D sprites."
          link="https://docs.decentraland.org/creator/scenes-sdk7/3d-content-essentials/entity-positioning#face-the-player"
          type="help"
        />
      }
      onRemoveContainer={handleRemove}
    >
      <Block>
        <Dropdown
          label="Billboard Mode"
          options={BILLBOARD_MODE_OPTIONS}
          {...billboardMode}
        />
      </Block>
    </Container>
  );
});
