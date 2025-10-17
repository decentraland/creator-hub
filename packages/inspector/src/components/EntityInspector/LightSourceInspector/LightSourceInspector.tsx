import { useCallback } from 'react';
import { withSdk } from '../../../hoc/withSdk';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { useComponentInput } from '../../../hooks/sdk/useComponentInput';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { CheckboxField, Dropdown, RangeField, InfoTooltip } from '../../ui';
import { ColorField } from '../../ui/ColorField';
import { FileUploadField } from '../../ui';
import { ACCEPTED_FILE_TYPES } from '../../ui/FileUploadField/types';
import type { Props } from './types';
import { LightKind, LIGHT_TYPE_OPTIONS } from './types';
import { fromComponent, toComponent, isValidInput } from './utils';

export default withSdk<Props>(({ sdk, entity, initialOpen = true }) => {
  const { LightSource } = sdk.components;

  const hasComponent = useHasComponent(entity, LightSource);
  const { getInputProps } = useComponentInput(
    entity,
    LightSource,
    fromComponent,
    toComponent,
    isValidInput,
  );

  const handleRemove = useCallback(async () => {
    sdk.operations.removeComponent(entity, LightSource);
    await sdk.operations.dispatch();
  }, []);

  if (!hasComponent) return null;

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
          link="https://docs.decentraland.org/creator/development-guide/sdk7/lights/"
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
