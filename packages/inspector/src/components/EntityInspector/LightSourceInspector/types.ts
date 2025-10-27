import type { Entity } from '@dcl/ecs';

export enum LightKind {
  POINT = 'point',
  SPOT = 'spot',
}

export const LIGHT_TYPE_OPTIONS = [
  { label: 'Point Light', value: LightKind.POINT },
  { label: 'Spot Light', value: LightKind.SPOT },
];

export type LightInput = {
  type: LightKind;
  active: boolean;
  color: string;
  intensity: string;
  shadow: boolean;
  shadowMaskSrc?: string;
  range?: string;
  spot?: {
    innerAngle: string;
    outerAngle: string;
  };
};

export type Props = { entity: Entity; initialOpen?: boolean };
