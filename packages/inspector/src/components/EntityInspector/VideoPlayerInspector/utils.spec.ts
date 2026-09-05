import type { PBVideoPlayer } from '@dcl/ecs';

import type { TreeNode } from '../../ProjectAssetExplorer/ProjectView';
import {
  fromVideoPlayer,
  toVideoPlayer,
  volumeFromVideoPlayer,
  volumeToVideoPlayer,
  numberFromVideoPlayer,
  numberToVideoPlayer,
  isValidInput,
  isVideoFile,
  isVideo,
  isValidVolume,
  isValidPlaybackRate,
  isValidPosition,
  isValidSpatialDistance,
} from './utils';

describe('VideoPlayerUtils', () => {
  const assetCatalogResponse = {
    basePath: '/base/path',
    assets: [
      { path: '/base/path/video.mp4' },
      { path: '/base/path/audio.mp3' },
      { path: '/base/path/image.jpg' },
    ],
  };

  describe('fromVideoPlayer', () => {
    it('converts PBVideoPlayer to VideoPlayerInput', () => {
      const videoPlayer = { src: '/base/path/video.mp4', loop: true, playing: false, volume: 0.5 };
      const result = fromVideoPlayer(videoPlayer);
      expect(result).toEqual({
        src: '/base/path/video.mp4',
        loop: true,
        playing: false,
        volume: '50',
      });
    });

    describe('when the video player has every protocol field set', () => {
      it('should convert all fields to their input representation', () => {
        const videoPlayer: PBVideoPlayer = {
          src: '/base/path/video.mp4',
          loop: true,
          playing: false,
          volume: 0.5,
          position: 12.5,
          playbackRate: 1.25,
          spatial: true,
          spatialMinDistance: 4,
          spatialMaxDistance: 42,
        };
        const result = fromVideoPlayer(videoPlayer);
        expect(result).toEqual({
          src: '/base/path/video.mp4',
          loop: true,
          playing: false,
          volume: '50',
          position: '12.5',
          playbackRate: '1.25',
          spatial: true,
          spatialMinDistance: '4',
          spatialMaxDistance: '42',
        });
      });
    });
  });

  describe('toVideoPlayer', () => {
    it('converts VideoPlayerInput to PBVideoPlayer', () => {
      const videoPlayerInput = { src: 'video.mp4', loop: true, playing: false, volume: '50' };
      const result = toVideoPlayer(videoPlayerInput);
      expect(result).toEqual({
        src: 'video.mp4',
        loop: true,
        playing: false,
        volume: 0.5,
      });
    });

    describe('when the input has every field set', () => {
      it('should convert all fields to their protocol representation', () => {
        const videoPlayerInput = {
          src: 'video.mp4',
          loop: true,
          playing: false,
          volume: '50',
          position: '12.5',
          playbackRate: '1.25',
          spatial: true,
          spatialMinDistance: '4',
          spatialMaxDistance: '42',
        };
        const result = toVideoPlayer(videoPlayerInput);
        expect(result).toEqual({
          src: 'video.mp4',
          loop: true,
          playing: false,
          volume: 0.5,
          position: 12.5,
          playbackRate: 1.25,
          spatial: true,
          spatialMinDistance: 4,
          spatialMaxDistance: 42,
        });
      });
    });

    describe('when the numeric input fields are empty', () => {
      it('should leave the corresponding protocol fields unset', () => {
        const result = toVideoPlayer({
          src: 'video.mp4',
          position: '',
          playbackRate: '',
          spatialMinDistance: '',
          spatialMaxDistance: '',
        });
        expect(result.position).toBeUndefined();
        expect(result.playbackRate).toBeUndefined();
        expect(result.spatialMinDistance).toBeUndefined();
        expect(result.spatialMaxDistance).toBeUndefined();
      });
    });
  });

  describe('when a PBVideoPlayer with code-authored values goes through a fromVideoPlayer → toVideoPlayer round trip', () => {
    it('should preserve every protocol field unchanged', () => {
      const videoPlayer: PBVideoPlayer = {
        src: 'https://example.com/stream.mp4',
        playing: true,
        position: 30,
        volume: 0.75,
        playbackRate: 0.5,
        loop: false,
        spatial: true,
        spatialMinDistance: 2,
        spatialMaxDistance: 100,
      };
      expect(toVideoPlayer(fromVideoPlayer(videoPlayer))).toEqual(videoPlayer);
    });

    describe('and the optional fields are unset', () => {
      it('should keep them unset instead of materializing defaults', () => {
        const videoPlayer: PBVideoPlayer = { src: 'video.mp4' };
        const result = toVideoPlayer(fromVideoPlayer(videoPlayer));
        expect(result.position).toBeUndefined();
        expect(result.playbackRate).toBeUndefined();
        expect(result.spatial).toBeUndefined();
        expect(result.spatialMinDistance).toBeUndefined();
        expect(result.spatialMaxDistance).toBeUndefined();
      });
    });
  });

  describe('numberFromVideoPlayer', () => {
    describe('when the value is a number', () => {
      it('should convert it to its string representation', () => {
        expect(numberFromVideoPlayer(1.25)).toBe('1.25');
      });
    });

    describe('when the value is zero', () => {
      it('should convert it to "0" instead of dropping it', () => {
        expect(numberFromVideoPlayer(0)).toBe('0');
      });
    });

    describe('when the value is undefined', () => {
      it('should return undefined', () => {
        expect(numberFromVideoPlayer(undefined)).toBeUndefined();
      });
    });
  });

  describe('numberToVideoPlayer', () => {
    describe('when the value is a numeric string', () => {
      it('should parse it as a number', () => {
        expect(numberToVideoPlayer('12.5')).toBe(12.5);
      });
    });

    describe('when the value is empty or undefined', () => {
      it('should return undefined', () => {
        expect(numberToVideoPlayer('')).toBeUndefined();
        expect(numberToVideoPlayer(undefined)).toBeUndefined();
      });
    });

    describe('when the value is not parseable as a number', () => {
      it('should return undefined', () => {
        expect(numberToVideoPlayer('invalid')).toBeUndefined();
      });
    });
  });

  describe('volumeFromVideoPlayer', () => {
    it('converts volume from VideoPlayer to string', () => {
      const result = volumeFromVideoPlayer(0.75);
      expect(result).toBe('75');
    });
  });

  describe('volumeToVideoPlayer', () => {
    it('converts volume from string to VideoPlayer', () => {
      const result = volumeToVideoPlayer('50');
      expect(result).toBe(0.5);
    });
  });

  describe('isValidInput', () => {
    it('returns true for a valid input', () => {
      const result = isValidInput(assetCatalogResponse, 'video.mp4');
      expect(result).toBe(true);
    });

    it('returns false for an invalid input', () => {
      const result = isValidInput(assetCatalogResponse, 'invalid.mp4');
      expect(result).toBe(false);
    });
  });

  describe('isVideoFile', () => {
    it('returns true for an video file', () => {
      const result = isVideoFile('video.mp4');
      expect(result).toBe(true);
    });

    it('returns false for a non-video file', () => {
      const result = isVideoFile('image.jpg');
      expect(result).toBe(false);
    });
  });

  describe('isVideo', () => {
    it('returns true for an video node', () => {
      const videoNode = { type: 'asset', name: 'video.mp4' } as TreeNode;
      const result = isVideo(videoNode);
      expect(result).toBe(true);
    });

    it('returns false for a non-video node', () => {
      const imageNode = { type: 'asset', name: 'image.jpg' } as TreeNode;
      const result = isVideo(imageNode);
      expect(result).toBe(false);
    });
  });

  describe('isValidVolume', () => {
    it('returns true for a valid volume', () => {
      const result = isValidVolume('50');
      expect(result).toBe(true);
    });

    it('returns false for an invalid volume', () => {
      const result = isValidVolume('invalid');
      expect(result).toBe(false);
    });
  });

  describe('isValidPlaybackRate', () => {
    describe('when the rate is a positive number', () => {
      it('should return true', () => {
        expect(isValidPlaybackRate('0.5')).toBe(true);
        expect(isValidPlaybackRate('2')).toBe(true);
      });
    });

    describe('when the rate is empty', () => {
      it('should return true since empty means unset', () => {
        expect(isValidPlaybackRate('')).toBe(true);
        expect(isValidPlaybackRate(undefined)).toBe(true);
      });
    });

    describe('when the rate is zero, negative or not a number', () => {
      it('should return false', () => {
        expect(isValidPlaybackRate('0')).toBe(false);
        expect(isValidPlaybackRate('-1')).toBe(false);
        expect(isValidPlaybackRate('invalid')).toBe(false);
      });
    });
  });

  describe('isValidPosition', () => {
    describe('when the position is zero or a positive number', () => {
      it('should return true', () => {
        expect(isValidPosition('0')).toBe(true);
        expect(isValidPosition('12.5')).toBe(true);
      });
    });

    describe('when the position is empty', () => {
      it('should return true since empty means unset', () => {
        expect(isValidPosition('')).toBe(true);
        expect(isValidPosition(undefined)).toBe(true);
      });
    });

    describe('when the position is negative or not a number', () => {
      it('should return false', () => {
        expect(isValidPosition('-1')).toBe(false);
        expect(isValidPosition('invalid')).toBe(false);
      });
    });
  });

  describe('isValidSpatialDistance', () => {
    describe('when the distance is zero or a positive number', () => {
      it('should return true', () => {
        expect(isValidSpatialDistance('0')).toBe(true);
        expect(isValidSpatialDistance('60')).toBe(true);
      });
    });

    describe('when the distance is empty', () => {
      it('should return true since empty means unset', () => {
        expect(isValidSpatialDistance('')).toBe(true);
        expect(isValidSpatialDistance(undefined)).toBe(true);
      });
    });

    describe('when the distance is negative or not a number', () => {
      it('should return false', () => {
        expect(isValidSpatialDistance('-5')).toBe(false);
        expect(isValidSpatialDistance('invalid')).toBe(false);
      });
    });
  });
});
