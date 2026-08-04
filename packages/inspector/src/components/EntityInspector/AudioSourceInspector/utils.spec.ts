import type { PBAudioSource } from '@dcl/ecs';

import {
  fromAudioSource,
  toAudioSource,
  volumeFromAudioSource,
  volumeToAudioSource,
  pitchFromAudioSource,
  pitchToAudioSource,
  currentTimeFromAudioSource,
  currentTimeToAudioSource,
  isValidVolume,
  isValidPitch,
} from './utils';

describe('AudioSourceInspector utils', () => {
  describe('when converting volume between component and input', () => {
    describe('and the volume is defined', () => {
      it('should convert the component volume to a percentage string', () => {
        expect(volumeFromAudioSource(0.75)).toBe('75');
      });

      it('should convert the percentage string back to a component volume', () => {
        expect(volumeToAudioSource('75')).toBe(0.75);
      });
    });

    describe('and the volume is undefined', () => {
      it('should default to 100', () => {
        expect(volumeFromAudioSource(undefined)).toBe('100');
      });
    });
  });

  describe('when converting pitch between component and input', () => {
    describe('and the pitch is defined', () => {
      it('should convert the component pitch to a string', () => {
        expect(pitchFromAudioSource(1.5)).toBe('1.5');
      });

      it('should convert the string back to a component pitch', () => {
        expect(pitchToAudioSource('1.5')).toBe(1.5);
      });
    });

    describe('and the pitch is undefined', () => {
      it('should default to 1', () => {
        expect(pitchFromAudioSource(undefined)).toBe('1');
        expect(pitchToAudioSource(undefined)).toBe(1);
      });
    });

    describe('and the pitch is not a number', () => {
      it('should fall back to the default pitch of 1', () => {
        expect(pitchToAudioSource('not-a-number')).toBe(1);
      });
    });
  });

  describe('when converting currentTime between component and input', () => {
    describe('and the currentTime is defined', () => {
      it('should carry the value through as a string', () => {
        expect(currentTimeFromAudioSource(12.5)).toBe('12.5');
      });

      it('should convert the string back to a number', () => {
        expect(currentTimeToAudioSource('12.5')).toBe(12.5);
      });
    });

    describe('and the currentTime is undefined', () => {
      it('should stay undefined in both directions', () => {
        expect(currentTimeFromAudioSource(undefined)).toBeUndefined();
        expect(currentTimeToAudioSource(undefined)).toBeUndefined();
      });
    });

    describe('and the currentTime is an empty or invalid string', () => {
      it('should stay undefined instead of writing NaN', () => {
        expect(currentTimeToAudioSource('')).toBeUndefined();
        expect(currentTimeToAudioSource('not-a-number')).toBeUndefined();
      });
    });
  });

  describe('when validating a volume input', () => {
    it('should accept values between 0 and 100', () => {
      expect(isValidVolume('0')).toBe(true);
      expect(isValidVolume('100')).toBe(true);
    });

    it('should reject values outside the range or non-numeric values', () => {
      expect(isValidVolume('101')).toBe(false);
      expect(isValidVolume('-1')).toBe(false);
      expect(isValidVolume('invalid')).toBe(false);
    });
  });

  describe('when validating a pitch input', () => {
    it('should accept positive numeric values', () => {
      expect(isValidPitch('1')).toBe(true);
      expect(isValidPitch('0.5')).toBe(true);
      expect(isValidPitch('2')).toBe(true);
    });

    it('should reject zero, negative, and non-numeric values', () => {
      expect(isValidPitch('0')).toBe(false);
      expect(isValidPitch('-1')).toBe(false);
      expect(isValidPitch('invalid')).toBe(false);
      expect(isValidPitch(undefined)).toBe(false);
    });
  });

  describe('when round-tripping a code-authored PBAudioSource through the input converters', () => {
    let original: PBAudioSource;

    beforeEach(() => {
      original = {
        audioClipUrl: 'sounds/track.mp3',
        playing: true,
        loop: false,
        volume: 0.75,
        pitch: 1.5,
        currentTime: 12.5,
        global: true,
      };
    });

    it('should preserve every field, including pitch and currentTime, unchanged', () => {
      expect(toAudioSource(fromAudioSource(original))).toEqual(original);
    });

    describe('and the optional fields are not set', () => {
      beforeEach(() => {
        original = { audioClipUrl: 'sounds/track.mp3' };
      });

      it('should not invent a currentTime value', () => {
        expect(toAudioSource(fromAudioSource(original)).currentTime).toBeUndefined();
      });
    });
  });
});
