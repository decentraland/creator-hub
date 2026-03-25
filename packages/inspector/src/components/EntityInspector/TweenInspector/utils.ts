import { Quaternion } from '@babylonjs/core';
import type { Move, PBTween, PBTweenSequence, Rotate, Scale } from '@dcl/ecs';
import { TweenType } from '@dcl/asset-packs';

import { formatFloat } from '../utils';
import type { TweenInput, TweenSequenceInput } from './types';

export const fromTween = (value: PBTween): TweenInput => {
  let type = TweenType.MOVE_ITEM;
  let start = { x: '0', y: '0', z: '0' };
  let end = { x: '0', y: '0', z: '0' };

  if (value.mode?.$case === 'move') {
    type = TweenType.MOVE_ITEM;
    start = {
      x: formatFloat(value.mode.move.start?.x ?? 0),
      y: formatFloat(value.mode.move.start?.y ?? 0),
      z: formatFloat(value.mode.move.start?.z ?? 0),
    };
    end = {
      x: formatFloat(value.mode.move.end?.x ?? 0),
      y: formatFloat(value.mode.move.end?.y ?? 0),
      z: formatFloat(value.mode.move.end?.z ?? 0),
    };
  } else if (value.mode?.$case === 'rotate') {
    type = TweenType.ROTATE_ITEM;
    const startAngles = new Quaternion(
      value.mode.rotate.start?.x ?? 0,
      value.mode.rotate.start?.y ?? 0,
      value.mode.rotate.start?.z ?? 0,
      value.mode.rotate.start?.w ?? 0,
    ).toEulerAngles();
    start = {
      x: formatAngle((startAngles.x * 180) / Math.PI),
      y: formatAngle((startAngles.y * 180) / Math.PI),
      z: formatAngle((startAngles.z * 180) / Math.PI),
    };
    const endAngles = new Quaternion(
      value.mode.rotate.end?.x ?? 0,
      value.mode.rotate.end?.y ?? 0,
      value.mode.rotate.end?.z ?? 0,
      value.mode.rotate.end?.w ?? 0,
    ).toEulerAngles();
    end = {
      x: formatAngle((endAngles.x * 180) / Math.PI),
      y: formatAngle((endAngles.y * 180) / Math.PI),
      z: formatAngle((endAngles.z * 180) / Math.PI),
    };
  } else if (value.mode?.$case === 'scale') {
    type = TweenType.SCALE_ITEM;
    start = {
      x: formatFloat(value.mode.scale.start?.x ?? 0),
      y: formatFloat(value.mode.scale.start?.y ?? 0),
      z: formatFloat(value.mode.scale.start?.z ?? 0),
    };
    end = {
      x: formatFloat(value.mode.scale.end?.x ?? 0),
      y: formatFloat(value.mode.scale.end?.y ?? 0),
      z: formatFloat(value.mode.scale.end?.z ?? 0),
    };
  }

  return {
    type,
    start,
    end,
    duration: (value.duration / 1000).toString(),
    easingFunction: value.easingFunction.toString(),
    playing: value.playing,
  };
};

export const toTween = (value: TweenInput): PBTween => {
  let mode:
    | { $case: 'move'; move: Move }
    | { $case: 'rotate'; rotate: Rotate }
    | { $case: 'scale'; scale: Scale }
    | undefined;

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
    const start = Quaternion.RotationYawPitchRoll(
      (Number(value.start.y) * Math.PI) / 180,
      (Number(value.start.x) * Math.PI) / 180,
      (Number(value.start.z) * Math.PI) / 180,
    );
    const end = Quaternion.RotationYawPitchRoll(
      (Number(value.end.y) * Math.PI) / 180,
      (Number(value.end.x) * Math.PI) / 180,
      (Number(value.end.z) * Math.PI) / 180,
    );

    mode = {
      $case: 'rotate',
      rotate: {
        start: { x: start.x, y: start.y, z: start.z, w: start.w },
        end: { x: end.x, y: end.y, z: end.z, w: end.w },
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
  }

  return {
    mode,
    duration: parseFloat(value.duration) * 1000,
    easingFunction: parseInt(value.easingFunction),
    playing: value.playing,
  };
};

function formatAngle(angle: number) {
  const sanitizedAngle = angle < 0 ? 360 + angle : angle;
  // Round to 4 decimal places before truncation to eliminate floating point noise
  // introduced by the quaternion↔Euler round-trip (e.g. 14.99999 → 15)
  const rounded = Math.round(sanitizedAngle * 10000) / 10000;
  const value = formatFloat(rounded);
  return value === '360' ? '0' : value;
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
