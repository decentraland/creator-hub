import type { TransformType } from '@dcl/ecs';
import { fromTransform, fromTransformConfig, getScale, mapToNumber, toTransform } from './utils';
import type { TransformInput } from './types';

const getTransform = (): TransformType => ({
  position: { x: 8, y: 0, z: 8 },
  scale: { x: 1, y: 1, z: 1 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
});

describe('TransformInspector utils', () => {
  describe('when converting the TransformType into a TransformInput', () => {
    let transform: TransformType;
    beforeEach(() => {
      transform = getTransform();
    });
    it('should convert position values to strings with two decimals', () => {
      const input = fromTransform(transform);
      expect(input.position.x).toBe('8.00');
      expect(input.position.y).toBe('0.00');
      expect(input.position.z).toBe('8.00');
    });
    it('should convert scale values to strings with two decimals', () => {
      const input = fromTransform(transform);
      expect(input.scale.x).toBe('1.00');
      expect(input.scale.y).toBe('1.00');
      expect(input.scale.z).toBe('1.00');
    });
    it('should convert rotation values from quaterion to euler angles, as strings with two decimals', () => {
      const input = fromTransform(transform);
      expect(input.rotation.x).toBe('0.00');
      expect(input.rotation.y).toBe('0.00');
      expect(input.rotation.z).toBe('0.00');
    });
  });
  describe('when converting the TransformInput into a TransformType', () => {
    let input: TransformInput;
    beforeEach(() => {
      input = {
        position: { x: '8.00', y: '0.00', z: '8.00' },
        scale: { x: '1.00', y: '1.00', z: '1.00' },
        rotation: { x: '0.00', y: '0.00', z: '0.00' },
      };
    });
    it('should convert position string values into numbers', () => {
      const transform = toTransform()(input);
      expect(transform.position.x).toBe(8);
      expect(transform.position.y).toBe(0);
      expect(transform.position.z).toBe(8);
    });
    it('should convert scale string values into numbers', () => {
      const transform = toTransform()(input);
      expect(transform.scale.x).toBe(1);
      expect(transform.scale.y).toBe(1);
      expect(transform.scale.z).toBe(1);
    });
    it('should convert rotation euler angles into a quaternion', () => {
      const tranform = toTransform()(input);
      expect(tranform.rotation.x).toBe(0);
      expect(tranform.rotation.y).toBe(0);
      expect(tranform.rotation.z).toBe(0);
      expect(tranform.rotation.w).toBe(1);
    });
    it('should scale values porportionally', () => {
      const newValue = { ...input, scale: { x: '2.00', y: '1.00', z: '1.00' } };
      const config = { porportionalScaling: true };
      const transform = toTransform(getTransform(), config)(newValue);
      expect(transform.scale.x).toBe(2);
      expect(transform.scale.y).toBe(2);
      expect(transform.scale.z).toBe(2);
    });
  });
  describe('mapToNumber', () => {
    it('should map object values to numbers', () => {
      const input = {
        a: '123',
        b: '456',
        c: '789',
      };

      const result = mapToNumber(input);

      expect(result).toEqual({
        a: 123,
        b: 456,
        c: 789,
      });
    });

    it('should handle empty object', () => {
      const input = {};

      const result = mapToNumber(input);

      expect(result).toEqual({});
    });

    it('should handle non-string values', () => {
      const input = {
        a: 123,
        b: true,
        c: null,
      };

      const result = mapToNumber(input);

      expect(result).toEqual({
        a: 123,
        b: 1,
        c: 0,
      });
    });

    it('should handle mixed string and non-string values', () => {
      const input = {
        a: '123',
        b: 456,
        c: '789',
        d: true,
      };

      const result = mapToNumber(input);

      expect(result).toEqual({
        a: 123,
        b: 456,
        c: 789,
        d: 1,
      });
    });
  });
  describe('getScale', () => {
    it('should return the same value when maintainProportion is false', () => {
      const oldValue = { x: 1, y: 2, z: 3 };
      const value = { x: 4, y: 5, z: 6 };
      const maintainProportion = false;

      const result = getScale(oldValue, value, maintainProportion);

      expect(result).toEqual(value);
    });

    it('should scale proportionally when x is changed', () => {
      const oldValue = { x: 2, y: 4, z: 6 };
      const value = { x: 4, y: 4, z: 6 };
      const maintainProportion = true;

      const result = getScale(oldValue, value, maintainProportion);

      // x doubled (2 -> 4), so y and z should also double (4 -> 8, 6 -> 12)
      expect(result).toEqual({ x: 4, y: 8, z: 12 });
    });

    it('should scale proportionally when y is changed', () => {
      const oldValue = { x: 1, y: 2, z: 3 };
      const value = { x: 1, y: 4, z: 3 };
      const maintainProportion = true;

      const result = getScale(oldValue, value, maintainProportion);

      // y doubled (2 -> 4), so x and z should also double
      expect(result).toEqual({ x: 2, y: 4, z: 6 });
    });

    it('should scale proportionally when z is changed', () => {
      const oldValue = { x: 2, y: 4, z: 6 };
      const value = { x: 2, y: 4, z: 3 };
      const maintainProportion = true;

      const result = getScale(oldValue, value, maintainProportion);

      // z halved (6 -> 3), so x and y should also halve
      expect(result).toEqual({ x: 1, y: 2, z: 3 });
    });

    it('should return the same value when no dimensions are changed', () => {
      const oldValue = { x: 1, y: 2, z: 3 };
      const value = { x: 1, y: 2, z: 3 };
      const maintainProportion = true;

      const result = getScale(oldValue, value, maintainProportion);

      expect(result).toEqual(value);
    });

    it('should scale proportionally when changing to decimal values less than 1', () => {
      const oldValue = { x: 1, y: 1, z: 1 };
      const value = { x: 0.5, y: 1, z: 1 };
      const maintainProportion = true;

      const result = getScale(oldValue, value, maintainProportion);

      // x halved, so all should become 0.5
      expect(result).toEqual({ x: 0.5, y: 0.5, z: 0.5 });
    });

    it('should scale proportionally when changing from decimal to decimal', () => {
      const oldValue = { x: 0.5, y: 0.5, z: 0.5 };
      const value = { x: 0.25, y: 0.5, z: 0.5 };
      const maintainProportion = true;

      const result = getScale(oldValue, value, maintainProportion);

      // x halved (0.5 -> 0.25), so all should halve
      expect(result).toEqual({ x: 0.25, y: 0.25, z: 0.25 });
    });

    it('should use other axes as reference when old changed value is zero', () => {
      const oldValue = { x: 0, y: 1, z: 1 };
      const value = { x: 0.5, y: 1, z: 1 };
      const maintainProportion = true;

      const result = getScale(oldValue, value, maintainProportion);

      // When oldChangedValue is 0, use another axis (y=1) as reference
      // ratio = 0.5 / 1 = 0.5, so all axes become 0.5
      expect(result).toEqual({ x: 0.5, y: 0.5, z: 0.5 });
    });

    it('should not apply proportional scaling when setting to zero (prevents accidental data loss)', () => {
      const oldValue = { x: 1, y: 1, z: 1 };
      const value = { x: 0, y: 1, z: 1 };
      const maintainProportion = true;

      const result = getScale(oldValue, value, maintainProportion);

      // When setting one axis to 0, we don't proportionally scale others to 0
      // This prevents data loss when typing decimals like "0.5" where "0" is intermediate
      expect(result).toEqual({ x: 0, y: 1, z: 1 });
    });

    it('should handle uneven scales correctly', () => {
      const oldValue = { x: 1, y: 2, z: 4 };
      const value = { x: 2, y: 2, z: 4 };
      const maintainProportion = true;

      const result = getScale(oldValue, value, maintainProportion);

      // x doubled (1 -> 2), so y should double (2 -> 4) and z should double (4 -> 8)
      expect(result).toEqual({ x: 2, y: 4, z: 8 });
    });

    it('should handle negative scales', () => {
      const oldValue = { x: 1, y: 1, z: 1 };
      const value = { x: -1, y: 1, z: 1 };
      const maintainProportion = true;

      const result = getScale(oldValue, value, maintainProportion);

      // x went negative, ratio is -1
      expect(result).toEqual({ x: -1, y: -1, z: -1 });
    });

    it('should handle scaling with negative old values', () => {
      const oldValue = { x: -2, y: 4, z: 6 };
      const value = { x: -4, y: 4, z: 6 };
      const maintainProportion = true;

      const result = getScale(oldValue, value, maintainProportion);

      // x doubled in magnitude (-2 -> -4), ratio is 2
      expect(result).toEqual({ x: -4, y: 8, z: 12 });
    });
  });
  describe('when converting the TransformConfig to TransformConfigInput', () => {
    it('should return an object with porportionalScaling set to true when passed true', () => {
      const input = {
        porportionalScaling: true,
      };

      const result = fromTransformConfig(input);

      expect(result).toEqual({
        porportionalScaling: true,
      });
    });

    it('should return an object with porportionalScaling set to false when passed false', () => {
      const input = {
        porportionalScaling: false,
      };

      const result = fromTransformConfig(input);

      expect(result).toEqual({
        porportionalScaling: false,
      });
    });

    it('should return an object with porportionalScaling set to false when not provided', () => {
      const input = {};

      const result = fromTransformConfig(input);

      expect(result).toEqual({
        porportionalScaling: false,
      });
    });
  });
});
