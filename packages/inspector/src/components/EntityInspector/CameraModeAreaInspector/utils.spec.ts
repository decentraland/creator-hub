import { CameraType } from '@dcl/ecs';
import type { PBCameraModeArea } from '@dcl/ecs';

import { MODE_OPTIONS, fromCameraModeArea, toCameraModeArea } from './utils';

describe('CameraModeAreaInspector utils', () => {
  describe('MODE_OPTIONS', () => {
    it('should offer First Person and Third Person only', () => {
      expect(MODE_OPTIONS).toEqual([
        { label: 'First Person', value: String(CameraType.CT_FIRST_PERSON) },
        { label: 'Third Person', value: String(CameraType.CT_THIRD_PERSON) },
      ]);
    });
  });

  describe('fromCameraModeArea', () => {
    it('should convert the mode to a string', () => {
      const value: PBCameraModeArea = {
        area: { x: 1, y: 1, z: 1 },
        mode: CameraType.CT_THIRD_PERSON,
      };
      expect(fromCameraModeArea(value)).toEqual({ mode: '1' });
    });

    describe('when the mode is undefined', () => {
      it('should default to First Person', () => {
        expect(fromCameraModeArea({} as PBCameraModeArea)).toEqual({ mode: '0' });
      });
    });
  });

  describe('toCameraModeArea', () => {
    it('should convert the mode back to a CameraType', () => {
      expect(toCameraModeArea({ mode: '1' })).toEqual({ mode: CameraType.CT_THIRD_PERSON });
    });

    it('should not carry an area field, so the current area is preserved on update', () => {
      expect('area' in toCameraModeArea({ mode: '0' })).toBe(false);
    });
  });
});
