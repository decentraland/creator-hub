import { useCallback } from 'react';
import { withSdk } from '../../../hoc/withSdk';
import { useAllEntitiesHaveComponent } from '../../../hooks/sdk/useHasComponent';
import { useMultiComponentInput } from '../../../hooks/sdk/useComponentInput';
import { analytics, Event } from '../../../lib/logic/analytics';
import { getAssetByModel } from '../../../lib/logic/catalog';
import { CoreComponents } from '../../../lib/sdk/components';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { CheckboxField, Dropdown, RangeField, InfoTooltip } from '../../ui';
import { ColorField } from '../../ui/ColorField';
import { FileUploadField } from '../../ui';
import { ACCEPTED_FILE_TYPES } from '../../ui/FileUploadField/types';
import type { Props } from './types';
import { LightKind, LIGHT_TYPE_OPTIONS } from './types';
import { fromComponent, toComponent, isValidInput } from './utils';

export default withSdk<Props>(({ sdk, entities, initialOpen = true }) => {
  const { LightSource, GltfContainer } = sdk.components;

  const allEntitiesHaveLightSource = useAllEntitiesHaveComponent(entities, LightSource);
  const { getInputProps } = useMultiComponentInput(
    entities,
    LightSource,
    fromComponent,
    toComponent,
    isValidInput,
  );

  const handleRemove = useCallback(async () => {
    for (const entity of entities) {
      sdk.operations.removeComponent(entity, LightSource);
    }
    await sdk.operations.dispatch();

    // GltfContainer may not exist on all entities with LightSource
    const gltfContainer = GltfContainer.getOrNull(entities[0]);
    const asset = gltfContainer ? getAssetByModel(gltfContainer.src) : undefined;
    analytics.track(Event.REMOVE_COMPONENT, {
      componentName: CoreComponents.LIGHT_SOURCE,
      itemId: asset?.id,
      itemPath: gltfContainer?.src,
    });
  }, [sdk, entities, LightSource, GltfContainer]);

  if (!allEntitiesHaveLightSource) return null;

  const type = getInputProps('type');
  const active = getInputProps('active', e => e.target.checked);
  const shadow = getInputProps('shadow', e => e.target.checked);
  const isSpot = type.value === LightKind.SPOT;

  return (
    <Container
      label="Light Source"
      className="LightSource"
      initialOpen={initialOpen}
      rightContent={
        <InfoTooltip
          text="Use lights to illuminate your scene beyond the default environmental light. See SDK7 Lights docs."
          link="https://docs.decentraland.org/creator/scenes-sdk7/3d-content-essentials/lights"
          type="help"
        />
      }
      onRemoveContainer={handleRemove}
    >
      <Block>
        <Dropdown
          label="Type"
          options={LIGHT_TYPE_OPTIONS}
          {...type}
        />
      </Block>
      <Block label="Active">
        <CheckboxField
          checked={!!active.value}
          {...active}
        />
      </Block>
      <Block label="Color">
        <ColorField {...getInputProps('color')} />
      </Block>
      <Block label="Intensity">
        <RangeField
          min={0}
          max={300000}
          step={1}
          {...getInputProps('intensity')}
        />
      </Block>
      {isSpot && (
        <Block label="Cast Shadows">
          <CheckboxField
            checked={!!shadow.value}
            {...shadow}
          />
        </Block>
      )}
      <Block label="Shadow mask texture">
        <FileUploadField
          label="Path"
          accept={ACCEPTED_FILE_TYPES['image']}
          {...getInputProps('shadowMaskSrc')}
        />
      </Block>
      <Block label="Range (optional)">
        <RangeField
          min={-1}
          max={1000}
          step={1}
          {...getInputProps('range')}
        />
      </Block>

      {isSpot && (
        <Container
          label="Spotlight"
          border
          initialOpen={false}
        >
          <Block label="Inner angle">
            <RangeField
              min={0}
              max={180}
              step={1}
              {...(getInputProps as any)('spot.innerAngle')}
            />
          </Block>
          <Block label="Outer angle">
            <RangeField
              min={0}
              max={180}
              step={1}
              {...(getInputProps as any)('spot.outerAngle')}
            />
          </Block>
        </Container>
      )}
    </Container>
  );
});
