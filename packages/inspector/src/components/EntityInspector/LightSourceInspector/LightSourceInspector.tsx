import React, { useCallback } from 'react';
import type { Entity, PBLightSource } from '@dcl/ecs';

import { withSdk } from '../../../hoc/withSdk';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { useComponentInput } from '../../../hooks/sdk/useComponentInput';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { CheckboxField, Dropdown, RangeField, InfoTooltip } from '../../ui';
import { ColorField } from '../../ui/ColorField';
import { toHex, toColor3 } from '../../ui/ColorField/utils';
import { FileUploadField } from '../../ui';
import { ACCEPTED_FILE_TYPES } from '../../ui/FileUploadField/types';
import { useAppSelector } from '../../../redux/hooks';
import { selectAssetCatalog } from '../../../redux/app';

type Props = { entity: Entity; initialOpen?: boolean };

enum LightKind {
  POINT = 'point',
  SPOT = 'spot',
}

const LIGHT_TYPE_OPTIONS = [
  { label: 'Point Light', value: LightKind.POINT },
  { label: 'Spot Light', value: LightKind.SPOT },
];

type LightInput = {
  type: LightKind;
  active: boolean;
  color: string;
  intensity: string; // string for input binding
  shadow: boolean;
  shadowMaskSrc?: string;
  range?: string;
  spot?: {
    innerAngle: string; // degrees 0-180
    outerAngle: string; // degrees 0-180
  };
};

// Use shared ColorField utils to preserve case/behavior of basic colors

const fromComponent = (value: PBLightSource): LightInput => {
  const base: LightInput = {
    type: value.type?.$case === 'spot' ? LightKind.SPOT : LightKind.POINT,
    active: !!value.active,
    color: toHex(value.color),
    intensity: String(value.intensity ?? 16000),
    shadow: !!(value as any).shadow,
    shadowMaskSrc:
      (value as any).shadowMaskTexture?.tex?.$case === 'texture'
        ? (value as any).shadowMaskTexture.tex.texture.src
        : '',
    range: String(value.range ?? -1),
    spot: undefined,
  };

  if (value.type?.$case === 'spot') {
    base.spot = {
      innerAngle: String(value.type.spot.innerAngle ?? 30),
      outerAngle: String(value.type.spot.outerAngle ?? 40),
    };
  }

  return base;
};

const toComponent = (input: LightInput): PBLightSource => {
  const isSpot = input.type === LightKind.SPOT;
  const type = isSpot
    ? {
        $case: 'spot',
        spot: {
          innerAngle: Number(input.spot?.innerAngle || 0),
          outerAngle: Number(input.spot?.outerAngle || 0),
        },
      }
    : { $case: 'point', point: {} };

  const shadowMaskTexture =
    input.shadowMaskSrc && input.shadowMaskSrc.length > 0
      ? {
          tex: {
            $case: 'texture',
            texture: {
              src: input.shadowMaskSrc,
            },
          },
        }
      : undefined;

  return {
    type: type as any,
    active: !!input.active,
    color: toColor3(input.color),
    intensity: Number(input.intensity || 0),
    shadow: !!input.shadow,
    range: input.range && input.range.length > 0 ? Number(input.range) : undefined,
    shadowMaskTexture: shadowMaskTexture as any,
  } as PBLightSource;
};

const isValidInput = (input: LightInput) => {
  const intensity = Number(input.intensity);
  if (isNaN(intensity)) return false;
  if (intensity < 0) return false;
  if (input.type === LightKind.SPOT) {
    const ia = Number(input.spot?.innerAngle ?? 0);
    const oa = Number(input.spot?.outerAngle ?? 0);
    if (isNaN(ia) || isNaN(oa)) return false;
    if (ia < 0 || ia > 180 || oa < 0 || oa > 180) return false;
  }
  return true;
};

export default withSdk<Props>(({ sdk, entity, initialOpen = true }) => {
  const { LightSource } = sdk.components as any;
  const files = useAppSelector(selectAssetCatalog);

  const has = useHasComponent(entity, LightSource);
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

  if (!has) return null;

  const type = getInputProps('type');
  const active = getInputProps('active', e => e.target.checked);
  const color = getInputProps('color');
  const intensity = getInputProps('intensity');
  const shadow = getInputProps('shadow', e => e.target.checked);
  const shadowMaskSrc = getInputProps('shadowMaskSrc');
  const range = getInputProps('range');

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
        <CheckboxField {...active} />
      </Block>
      <Block label="Color">
        <ColorField {...color} />
      </Block>
      <Block label="Intensity">
        <RangeField
          min={0}
          max={1000000}
          step={1}
          {...intensity}
        />
      </Block>
      <Block label="Cast Shadows">
        <CheckboxField {...shadow} />
      </Block>
      <Block label="Shadow mask texture">
        <FileUploadField
          label="Path"
          accept={ACCEPTED_FILE_TYPES['image']}
          {...shadowMaskSrc}
        />
      </Block>
      <Block label="Range (optional)">
        <RangeField
          min={-1}
          max={1000}
          step={1}
          {...range}
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
