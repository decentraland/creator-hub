import { Quaternion } from '@babylonjs/core';
import type { PBTween, PBTweenSequence } from '@dcl/ecs';
import { TweenType } from '@dcl/asset-packs';

import type { TweenInput, TweenModeType, TweenSequenceInput } from './types';
import { ContinuousTweenType, UNSUPPORTED_TWEEN_TYPE } from './types';

const zeroVector = () => ({ x: '0.00', y: '0.00', z: '0.00' });

export const fromTween = (value: PBTween): TweenInput => {
  let type: TweenModeType = TweenType.MOVE_ITEM;
  let start = zeroVector();
  let end = zeroVector();
  let direction = zeroVector();
  let speed = '1.00';
  let unsupportedMode = '';

  if (value.mode?.$case === 'move') {
    type = TweenType.MOVE_ITEM;
    start = {
      x: value.mode.move.start?.x.toFixed(2) ?? '0.00',
      y: value.mode.move.start?.y.toFixed(2) ?? '0.00',
      z: value.mode.move.start?.z.toFixed(2) ?? '0.00',
    };
    end = {
      x: value.mode.move.end?.x.toFixed(2) ?? '0.00',
      y: value.mode.move.end?.y.toFixed(2) ?? '0.00',
      z: value.mode.move.end?.z.toFixed(2) ?? '0.00',
    };
  } else if (value.mode?.$case === 'rotate') {
    type = TweenType.ROTATE_ITEM;
    start = quaternionToAngles(value.mode.rotate.start);
    end = quaternionToAngles(value.mode.rotate.end);
  } else if (value.mode?.$case === 'scale') {
    type = TweenType.SCALE_ITEM;
    start = {
      x: value.mode.scale.start?.x.toFixed(2) ?? '0.00',
      y: value.mode.scale.start?.y.toFixed(2) ?? '0.00',
      z: value.mode.scale.start?.z.toFixed(2) ?? '0.00',
    };
    end = {
      x: value.mode.scale.end?.x.toFixed(2) ?? '0.00',
      y: value.mode.scale.end?.y.toFixed(2) ?? '0.00',
      z: value.mode.scale.end?.z.toFixed(2) ?? '0.00',
    };
  } else if (value.mode?.$case === 'moveContinuous') {
    type = ContinuousTweenType.MOVE_CONTINUOUS;
    direction = {
      x: value.mode.moveContinuous.direction?.x.toFixed(2) ?? '0.00',
      y: value.mode.moveContinuous.direction?.y.toFixed(2) ?? '0.00',
      z: value.mode.moveContinuous.direction?.z.toFixed(2) ?? '0.00',
    };
    speed = value.mode.moveContinuous.speed.toFixed(2);
  } else if (value.mode?.$case === 'rotateContinuous') {
    type = ContinuousTweenType.ROTATE_CONTINUOUS;
    direction = quaternionToAngles(value.mode.rotateContinuous.direction);
    speed = value.mode.rotateContinuous.speed.toFixed(2);
  } else if (value.mode) {
    // modes the editor can't edit yet (textureMove, textureMoveContinuous, moveRotateScale, ...)
    type = UNSUPPORTED_TWEEN_TYPE;
    unsupportedMode = value.mode.$case;
  }

  return {
    type,
    start,
    end,
    direction,
    speed,
    unsupportedMode,
    duration: (value.duration / 1000).toString(),
    easingFunction: value.easingFunction.toString(),
    playing: value.playing,
  };
};

export const toTween = (value: TweenInput): PBTween => {
  const base = {
    duration: parseFloat(value.duration) * 1000,
    easingFunction: parseInt(value.easingFunction),
    playing: value.playing,
  };

  if (value.type === UNSUPPORTED_TWEEN_TYPE) {
    // omit the "mode" key entirely so merging with the current component value
    // preserves the unsupported mode instead of destroying it
    return base;
  }

  let mode: PBTween['mode'];

  if (value.type === TweenType.MOVE_ITEM) {
    mode = {
      $case: 'move',
      move: {
        start: {
          x: Number(value.start.x),
          y: Number(value.start.y),
          z: Number(value.start.z),
        },
        end: {
          x: Number(value.end.x),
          y: Number(value.end.y),
          z: Number(value.end.z),
        },
      },
    };
  } else if (value.type === TweenType.ROTATE_ITEM) {
    mode = {
      $case: 'rotate',
      rotate: {
        start: anglesToQuaternion(value.start),
        end: anglesToQuaternion(value.end),
      },
    };
  } else if (value.type === TweenType.SCALE_ITEM) {
    mode = {
      $case: 'scale',
      scale: {
        start: {
          x: Number(value.start.x),
          y: Number(value.start.y),
          z: Number(value.start.z),
        },
        end: {
          x: Number(value.end.x),
          y: Number(value.end.y),
          z: Number(value.end.z),
        },
      },
    };
  } else if (value.type === ContinuousTweenType.MOVE_CONTINUOUS) {
    mode = {
      $case: 'moveContinuous',
      moveContinuous: {
        direction: {
          x: Number(value.direction.x),
          y: Number(value.direction.y),
          z: Number(value.direction.z),
        },
        speed: Number(value.speed),
      },
    };
  } else if (value.type === ContinuousTweenType.ROTATE_CONTINUOUS) {
    mode = {
      $case: 'rotateContinuous',
      rotateContinuous: {
        direction: anglesToQuaternion(value.direction),
        speed: Number(value.speed),
      },
    };
  }

  return {
    ...base,
    mode,
  };
};

function quaternionToAngles(quaternion?: { x: number; y: number; z: number; w: number }) {
  const angles = new Quaternion(
    quaternion?.x ?? 0,
    quaternion?.y ?? 0,
    quaternion?.z ?? 0,
    quaternion?.w ?? 0,
  ).toEulerAngles();
  return {
    x: formatAngle((angles.x * 180) / Math.PI),
    y: formatAngle((angles.y * 180) / Math.PI),
    z: formatAngle((angles.z * 180) / Math.PI),
  };
}

function anglesToQuaternion(angles: { x: string; y: string; z: string }) {
  const quaternion = Quaternion.RotationYawPitchRoll(
    (Number(angles.y) * Math.PI) / 180,
    (Number(angles.x) * Math.PI) / 180,
    (Number(angles.z) * Math.PI) / 180,
  );
  return { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w };
}

function formatAngle(angle: number) {
  const sanitizedAngle = angle < 0 ? 360 + angle : angle;
  const value = sanitizedAngle.toFixed(2);
  return value === '360.00' ? '0.00' : value;
}

export const fromTweenSequence = (value: PBTweenSequence): TweenSequenceInput => {
  return {
    loop: value?.loop === 1,
  };
};

export const toTweenSequence = (value: TweenSequenceInput): PBTweenSequence => {
  return {
    sequence: [], // Default use the same entity to go and return
    loop: value.loop ? 1 : 0,
  };
};
