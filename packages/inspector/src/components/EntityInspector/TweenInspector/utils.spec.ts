import type { PBTween } from '@dcl/ecs';
import { EasingFunction } from '@dcl/ecs';
import { TweenType } from '@dcl/asset-packs';

import { fromTween, toTween } from './utils';
import type { TweenInput } from './types';
import { ContinuousTweenType, UNSUPPORTED_TWEEN_TYPE } from './types';

const baseInput: TweenInput = {
  type: TweenType.MOVE_ITEM,
  start: { x: '0.00', y: '0.00', z: '0.00' },
  end: { x: '0.00', y: '0.00', z: '0.00' },
  direction: { x: '0.00', y: '0.00', z: '0.00' },
  speed: '1.00',
  unsupportedMode: '',
  duration: '1',
  easingFunction: '0',
  playing: true,
};

describe('TweenInspector utils', () => {
  describe('when converting a move tween from component to input', () => {
    let value: PBTween;

    beforeEach(() => {
      value = {
        mode: {
          $case: 'move',
          move: { start: { x: 1, y: 2, z: 3 }, end: { x: 4, y: 5, z: 6 } },
        },
        duration: 2000,
        easingFunction: EasingFunction.EF_LINEAR,
        playing: true,
      };
    });

    it('should map the mode to the move item type with formatted vectors', () => {
      const input = fromTween(value);
      expect(input.type).toBe(TweenType.MOVE_ITEM);
      expect(input.start).toEqual({ x: '1.00', y: '2.00', z: '3.00' });
      expect(input.end).toEqual({ x: '4.00', y: '5.00', z: '6.00' });
      expect(input.duration).toBe('2');
    });
  });

  describe('when converting a move continuous tween from component to input', () => {
    let value: PBTween;

    beforeEach(() => {
      value = {
        mode: {
          $case: 'moveContinuous',
          moveContinuous: { direction: { x: 1, y: 0, z: -2.5 }, speed: 3 },
        },
        duration: 0,
        easingFunction: EasingFunction.EF_LINEAR,
        playing: true,
      };
    });

    it('should map the mode to the move continuous type with formatted direction and speed', () => {
      const input = fromTween(value);
      expect(input.type).toBe(ContinuousTweenType.MOVE_CONTINUOUS);
      expect(input.direction).toEqual({ x: '1.00', y: '0.00', z: '-2.50' });
      expect(input.speed).toBe('3.00');
    });
  });

  describe('when converting a rotate continuous tween from component to input', () => {
    let value: PBTween;

    beforeEach(() => {
      value = {
        mode: {
          $case: 'rotateContinuous',
          rotateContinuous: {
            direction: { x: 0, y: Math.sin(Math.PI / 4), z: 0, w: Math.cos(Math.PI / 4) },
            speed: 2,
          },
        },
        duration: 0,
        easingFunction: EasingFunction.EF_LINEAR,
        playing: true,
      };
    });

    it('should map the direction quaternion to euler degrees and keep the speed', () => {
      const input = fromTween(value);
      expect(input.type).toBe(ContinuousTweenType.ROTATE_CONTINUOUS);
      expect(input.direction).toEqual({ x: '0.00', y: '90.00', z: '0.00' });
      expect(input.speed).toBe('2.00');
    });
  });

  describe('when converting an unsupported tween mode from component to input', () => {
    let value: PBTween;

    beforeEach(() => {
      value = {
        mode: {
          $case: 'textureMove',
          textureMove: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
        },
        duration: 1000,
        easingFunction: EasingFunction.EF_LINEAR,
        playing: true,
      };
    });

    it('should mark the input as unsupported and remember the mode case', () => {
      const input = fromTween(value);
      expect(input.type).toBe(UNSUPPORTED_TWEEN_TYPE);
      expect(input.unsupportedMode).toBe('textureMove');
    });
  });

  describe('when converting a move continuous input to a component value', () => {
    let input: TweenInput;

    beforeEach(() => {
      input = {
        ...baseInput,
        type: ContinuousTweenType.MOVE_CONTINUOUS,
        direction: { x: '1', y: '0', z: '-2.5' },
        speed: '3',
      };
    });

    it('should build a moveContinuous mode with numeric direction and speed', () => {
      const tween = toTween(input);
      expect(tween.mode).toEqual({
        $case: 'moveContinuous',
        moveContinuous: { direction: { x: 1, y: 0, z: -2.5 }, speed: 3 },
      });
    });
  });

  describe('when converting a rotate continuous input to a component value', () => {
    let input: TweenInput;

    beforeEach(() => {
      input = {
        ...baseInput,
        type: ContinuousTweenType.ROTATE_CONTINUOUS,
        direction: { x: '0', y: '90', z: '0' },
        speed: '2',
      };
    });

    it('should build a rotateContinuous mode with a quaternion direction and the speed', () => {
      const tween = toTween(input);
      expect(tween.mode?.$case).toBe('rotateContinuous');
      if (tween.mode?.$case !== 'rotateContinuous') throw new Error('wrong mode');
      const { direction, speed } = tween.mode.rotateContinuous;
      expect(direction?.x).toBeCloseTo(0);
      expect(direction?.y).toBeCloseTo(Math.sin(Math.PI / 4));
      expect(direction?.z).toBeCloseTo(0);
      expect(direction?.w).toBeCloseTo(Math.cos(Math.PI / 4));
      expect(speed).toBe(2);
    });

    it('should round-trip the euler degrees through the quaternion', () => {
      const tween = toTween(input);
      const roundTripped = fromTween({ ...tween, duration: 0 });
      expect(roundTripped.direction).toEqual({ x: '0.00', y: '90.00', z: '0.00' });
    });
  });

  describe('when converting an unsupported input to a component value', () => {
    let input: TweenInput;

    beforeEach(() => {
      input = {
        ...baseInput,
        type: UNSUPPORTED_TWEEN_TYPE,
        unsupportedMode: 'textureMove',
        duration: '2',
        easingFunction: '1',
      };
    });

    it('should omit the mode key so merging preserves the existing mode', () => {
      const tween = toTween(input);
      expect('mode' in tween).toBe(false);
      expect(tween.duration).toBe(2000);
      expect(tween.easingFunction).toBe(1);
    });

    it('should preserve the unsupported mode when spread over the current component value', () => {
      const current: PBTween = {
        mode: {
          $case: 'textureMove',
          textureMove: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
        },
        duration: 1000,
        easingFunction: EasingFunction.EF_LINEAR,
        playing: true,
      };
      const merged = { ...current, ...toTween(input) };
      expect(merged.mode).toEqual(current.mode);
      expect(merged.duration).toBe(2000);
    });
  });

  describe('when converting a rotate input to a component value', () => {
    let input: TweenInput;

    beforeEach(() => {
      input = {
        ...baseInput,
        type: TweenType.ROTATE_ITEM,
        start: { x: '0', y: '0', z: '0' },
        end: { x: '0', y: '180', z: '0' },
      };
    });

    it('should still build a rotate mode with quaternion start and end', () => {
      const tween = toTween(input);
      expect(tween.mode?.$case).toBe('rotate');
      if (tween.mode?.$case !== 'rotate') throw new Error('wrong mode');
      expect(tween.mode.rotate.end?.y).toBeCloseTo(1);
      expect(tween.mode.rotate.end?.w).toBeCloseTo(0);
    });
  });
});
