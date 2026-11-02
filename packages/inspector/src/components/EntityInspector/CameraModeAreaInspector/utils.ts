import { CameraType } from '@dcl/ecs';
import type { PBCameraModeArea } from '@dcl/ecs';

// Cinematic mode is intentionally not offered: it is scene-controlled via
// VirtualCamera and not applicable to a camera mode area.
export const MODE_OPTIONS = [
  { label: 'First Person', value: String(CameraType.CT_FIRST_PERSON) },
  { label: 'Third Person', value: String(CameraType.CT_THIRD_PERSON) },
];

export type CameraModeAreaInput = {
  mode: string;
};

export function fromCameraModeArea(value: PBCameraModeArea): CameraModeAreaInput {
  return {
    mode: String(value?.mode ?? CameraType.CT_FIRST_PERSON),
  };
}

// Returns only the `mode` field: updateValue merges keys onto the current
// component value, so the (hidden, scale-driven) `area` field is preserved.
export function toCameraModeArea(input: CameraModeAreaInput): PBCameraModeArea {
  return {
    mode: Number(input.mode) as CameraType,
  } as PBCameraModeArea;
}
