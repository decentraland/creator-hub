import { TextureFilterMode, TextureWrapMode } from '@dcl/ecs';

import type { ParticleSystemComponentType } from '../../../lib/sdk/components/ParticleSystem';
import type { ParticleSystemInput } from './types';
import { eulerDegreesToQuaternion, fromComponent, toComponent, isValidInput } from './utils';

const getEmptyComponent = (): ParticleSystemComponentType => ({});

const getBaseInput = (): ParticleSystemInput => fromComponent(getEmptyComponent());

// A fully code-authored component with every PBParticleSystem field set. Rotations are
// authored through the same euler->quaternion conversion the editor uses, so the values
// are exactly representable by the editor inputs.
const getFullComponent = (): ParticleSystemComponentType => ({
  active: true,
  rate: 12,
  maxParticles: 500,
  lifetime: 3,
  gravity: 0.5,
  additionalForce: { x: 1, y: 2, z: 3 },
  initialSize: { start: 0.5, end: 2 },
  sizeOverTime: { start: 1, end: 0.25 },
  initialRotation: eulerDegreesToQuaternion({ x: '30', y: '45', z: '10' }),
  rotationOverTime: eulerDegreesToQuaternion({ x: '0', y: '30', z: '-15' }),
  faceTravelDirection: true,
  initialColor: {
    start: { r: 1, g: 0, b: 0, a: 0.5 },
    end: { r: 0, g: 1, b: 0, a: 1 },
  },
  colorOverTime: {
    start: { r: 0, g: 0, b: 1, a: 1 },
    end: { r: 1, g: 1, b: 1, a: 0 },
  },
  initialVelocitySpeed: { start: 1, end: 4 },
  texture: {
    src: 'assets/scene/smoke.png',
    wrapMode: TextureWrapMode.TWM_MIRROR,
    filterMode: TextureFilterMode.TFM_TRILINEAR,
    offset: { x: 0.25, y: 0.5 },
    tiling: { x: 2, y: 3 },
  },
  blendMode: 1,
  billboard: false,
  spriteSheet: { tilesX: 4, tilesY: 4, framesPerSecond: 24 },
  shape: { $case: 'cone', cone: { angle: 30, radius: 2 } },
  loop: false,
  prewarm: false,
  simulationSpace: 1,
  limitVelocity: { speed: 6, dampen: 0.5 },
  playbackState: 2,
  bursts: { values: [{ time: 0.5, count: 20, cycles: 2, interval: 0.1, probability: 0.75 }] },
});

describe('ParticleSystemInspector utils', () => {
  describe('when converting a component into an input', () => {
    describe('and the rotation fields are set', () => {
      it('should convert the quaternions into euler angles in degrees', () => {
        const input = fromComponent(getFullComponent());
        expect(input.initialRotation).toEqual({ x: '30', y: '45', z: '10' });
        expect(input.rotationOverTime).toEqual({ x: '0', y: '30', z: '-15' });
      });
    });
    describe('and the rotation fields are unset', () => {
      it('should default the euler angles to zero', () => {
        const input = fromComponent(getEmptyComponent());
        expect(input.initialRotation).toEqual({ x: '0', y: '0', z: '0' });
        expect(input.rotationOverTime).toEqual({ x: '0', y: '0', z: '0' });
      });
    });
    describe('and the texture has all fields set', () => {
      it('should convert every texture field into strings', () => {
        const input = fromComponent(getFullComponent());
        expect(input.textureEnabled).toBe(true);
        expect(input.texture).toEqual({
          src: 'assets/scene/smoke.png',
          wrapMode: String(TextureWrapMode.TWM_MIRROR),
          filterMode: String(TextureFilterMode.TFM_TRILINEAR),
          offset: { x: '0.25', y: '0.5' },
          tiling: { x: '2', y: '3' },
        });
      });
    });
    describe('and the texture only has a src', () => {
      it('should keep the optional texture fields as empty strings', () => {
        const input = fromComponent({ texture: { src: 'smoke.png' } });
        expect(input.texture).toEqual({
          src: 'smoke.png',
          wrapMode: '',
          filterMode: '',
          offset: { x: '', y: '' },
          tiling: { x: '', y: '' },
        });
      });
    });
  });

  describe('when converting an input into a component', () => {
    describe('and the rotation inputs are zero', () => {
      it('should leave the rotation fields unset', () => {
        const component = toComponent(getBaseInput());
        expect(component.initialRotation).toBeUndefined();
        expect(component.rotationOverTime).toBeUndefined();
      });
    });
    describe('and the rotation inputs are non-zero', () => {
      it('should convert the euler angles into quaternions', () => {
        const input = {
          ...getBaseInput(),
          initialRotation: { x: '30', y: '45', z: '10' },
          rotationOverTime: { x: '0', y: '30', z: '-15' },
        };
        const component = toComponent(input);
        expect(component.initialRotation).toEqual(
          eulerDegreesToQuaternion({ x: '30', y: '45', z: '10' }),
        );
        expect(component.rotationOverTime).toEqual(
          eulerDegreesToQuaternion({ x: '0', y: '30', z: '-15' }),
        );
      });
    });
    describe('and the texture is disabled', () => {
      it('should set the texture to undefined so it gets removed on merge', () => {
        const component = toComponent(getBaseInput());
        expect('texture' in component).toBe(true);
        expect(component.texture).toBeUndefined();
      });
    });
    describe('and the texture is enabled without optional fields', () => {
      it('should only write the src and keep wrap/filter/offset/tiling unset', () => {
        const input = {
          ...getBaseInput(),
          textureEnabled: true,
          texture: {
            src: 'smoke.png',
            wrapMode: '',
            filterMode: '',
            offset: { x: '', y: '' },
            tiling: { x: '', y: '' },
          },
        };
        const component = toComponent(input);
        expect(component.texture).toEqual({ src: 'smoke.png' });
        expect(component.texture?.wrapMode).toBeUndefined();
        expect(component.texture?.filterMode).toBeUndefined();
        expect(component.texture?.offset).toBeUndefined();
        expect(component.texture?.tiling).toBeUndefined();
      });
    });
    describe('and only one axis of the texture offset or tiling is set', () => {
      it('should fill the other axis with the engine default', () => {
        const input = {
          ...getBaseInput(),
          textureEnabled: true,
          texture: {
            src: 'smoke.png',
            wrapMode: '',
            filterMode: '',
            offset: { x: '0.5', y: '' },
            tiling: { x: '', y: '2' },
          },
        };
        const component = toComponent(input);
        expect(component.texture?.offset).toEqual({ x: 0.5, y: 0 });
        expect(component.texture?.tiling).toEqual({ x: 1, y: 2 });
      });
    });
  });

  describe('when round-tripping a fully authored component through the editor converters', () => {
    it('should return the component unchanged', () => {
      const component = getFullComponent();
      expect(toComponent(fromComponent(component))).toEqual(component);
    });
  });

  describe('when round-tripping a component with a bare texture', () => {
    it('should not materialize the unset texture fields', () => {
      const component: ParticleSystemComponentType = { texture: { src: 'smoke.png' } };
      const result = toComponent(fromComponent(component));
      expect(result.texture).toEqual({ src: 'smoke.png' });
    });
  });

  describe('when round-tripping a component without rotations or texture', () => {
    it('should keep those fields unset', () => {
      const result = toComponent(fromComponent(getEmptyComponent()));
      expect(result.initialRotation).toBeUndefined();
      expect(result.rotationOverTime).toBeUndefined();
      expect(result.texture).toBeUndefined();
    });
  });

  describe('when validating the input', () => {
    describe('and a rotation field is not a number', () => {
      it('should return false', () => {
        const input = { ...getBaseInput(), initialRotation: { x: 'abc', y: '0', z: '0' } };
        expect(isValidInput(input)).toBe(false);
      });
    });
    describe('and a texture offset field is not a number while the texture is enabled', () => {
      it('should return false', () => {
        const base = getBaseInput();
        const input = {
          ...base,
          textureEnabled: true,
          texture: { ...base.texture, offset: { x: 'abc', y: '' } },
        };
        expect(isValidInput(input)).toBe(false);
      });
    });
    describe('and the texture fields are empty strings', () => {
      it('should return true', () => {
        const input = { ...getBaseInput(), textureEnabled: true };
        expect(isValidInput(input)).toBe(true);
      });
    });
  });
});
