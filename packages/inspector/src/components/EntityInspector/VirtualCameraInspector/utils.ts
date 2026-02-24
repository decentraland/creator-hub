import type { PBVirtualCamera } from '@dcl/ecs/dist/components/generated/pb/decentraland/sdk/components/virtual_camera.gen';

export type VirtualCameraInput = {
  transitionMode: 'time' | 'speed';
  transitionValue: string;
  lookAtEntity?: string;
};

export function fromVirtualCamera(value: PBVirtualCamera): VirtualCameraInput {
  const defaultTransition = value?.defaultTransition;
  const transitionMode = defaultTransition?.transitionMode;

  let mode: 'time' | 'speed' = 'time';
  let numericValue = 1;

  if (transitionMode) {
    if (transitionMode.$case === 'speed') {
      mode = 'speed';
      numericValue = transitionMode.speed;
    } else if (transitionMode.$case === 'time') {
      mode = 'time';
      numericValue = transitionMode.time;
    }
  }

  return {
    transitionMode: mode,
    transitionValue: String(numericValue),
    lookAtEntity: value?.lookAtEntity !== undefined ? String(value.lookAtEntity) : undefined,
  };
}

export function toVirtualCamera(input: VirtualCameraInput, VirtualCamera: any): PBVirtualCamera {
  const numericValue = parseFloat(input.transitionValue);

  return {
    defaultTransition: {
      transitionMode:
        input.transitionMode === 'speed'
          ? VirtualCamera.Transition.Speed(numericValue)
          : VirtualCamera.Transition.Time(numericValue),
    },
    lookAtEntity: input.lookAtEntity ? parseInt(input.lookAtEntity, 10) : undefined,
  };
}
