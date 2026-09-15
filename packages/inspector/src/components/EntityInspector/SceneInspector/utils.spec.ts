import type { EditorComponentsTypes } from '../../../lib/sdk/components';
import { SceneAgeRating, SceneCategory } from '../../../lib/sdk/components';
import { TransitionMode } from '../../../lib/sdk/components/SceneMetadata';
import type { Layout } from '../../../lib/utils/layout';
import type { SceneInput } from './types';
import {
  fromScene,
  getThumbnailWarnings,
  hasThumbnailAspectRatio,
  isValidInput,
  parseParcels,
  toScene,
} from './utils';

//TODO fix tests
function getInput(base: string, parcels: string): SceneInput {
  const input: SceneInput = {
    name: 'name',
    description: 'description',
    thumbnail: 'assets/scene/thumbnail.png',
    ageRating: 'A',
    categories: ['game'],
    tags: 'tag1, tag2',
    silenceVoiceChat: false,
    disablePortableExperiences: false,
    disableNearbyVoiceChat: false,
    hideLandscapeTerrain: false,
    spawnPoints: [],
    creator: '0x0000000000000000000000000000000000000000',
    author: 'John Doe',
    email: 'johndoe@gmail.com',
    skyboxConfig: {
      fixedTime: '36000',
      transitionMode: TransitionMode.TM_FORWARD.toString(),
    },
    layout: {
      base,
      parcels,
    },
  };
  return input;
}

function getScene(layout: Layout): EditorComponentsTypes['Scene'] {
  const scene: EditorComponentsTypes['Scene'] = {
    name: 'name',
    description: 'description',
    creator: '0x0000000000000000000000000000000000000000',
    thumbnail: 'assets/scene/thumbnail.png',
    ageRating: SceneAgeRating.Adult,
    categories: [SceneCategory.GAME],
    tags: ['tag1', 'tag2'],
    silenceVoiceChat: false,
    disablePortableExperiences: false,
    disableNearbyVoiceChat: false,
    hideLandscapeTerrain: false,
    spawnPoints: [],
    author: 'John Doe',
    email: 'johndoe@gmail.com',
    layout,
    skyboxConfig: {
      fixedTime: 36000,
      transitionMode: TransitionMode.TM_FORWARD,
    },
  };
  return scene;
}

describe('SceneInspector/utils', () => {
  describe('fromScene', () => {
    it('should convert a Scene to a SceneInput', () => {
      const scene = getScene({
        base: { x: 1, y: 1 },
        parcels: [
          { x: 1, y: 1 },
          { x: 2, y: 2 },
        ],
      });

      const result = fromScene(scene);

      expect(result).toEqual(getInput('1,1', '1,1 2,2'));
    });
  });

  describe('toScene', () => {
    it('should convert a SceneInput to a Scene', () => {
      const input = getInput('1,1', '1,1 2,2');

      const result = toScene(input);

      expect(result).toEqual(
        getScene({
          base: { x: 1, y: 1 },
          parcels: [
            { x: 1, y: 1 },
            { x: 2, y: 2 },
          ],
        }),
      );
    });
  });

  describe('parseParcels', () => {
    it('should parse a string of parcels into Coords array', () => {
      const input = '1,1 2,2 3,3';

      const result = parseParcels(input);

      expect(result).toEqual([
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 3 },
      ]);
    });

    it('should return an empty array for invalid input', () => {
      const input = '1,1 2,2 invalid 3,3';

      const result = parseParcels(input);

      expect(result).toEqual([]);
    });
  });

  describe('isValidInput', () => {
    it('should return true for connected parcels', () => {
      const validInput = getInput('1,1', '1,1 1,2');
      const invalidInput = getInput('1,1', '1,1 2,2');

      const isValidValidInput = isValidInput(validInput);
      const isValidInvalidInput = isValidInput(invalidInput);

      expect(isValidValidInput).toBe(true);
      expect(isValidInvalidInput).toBe(false);
    });

    it('should return true if parcels contains base coord', () => {
      const validInput = getInput('1,1', '1,1 1,2');
      const invalidInput = getInput('0,1', '1,1 2,2');

      const isValidValidInput = isValidInput(validInput);
      const isValidInvalidInput = isValidInput(invalidInput);

      expect(isValidValidInput).toBe(true);
      expect(isValidInvalidInput).toBe(false);
    });
  });

  describe('hasThumbnailAspectRatio', () => {
    it('should accept the recommended 1920x1080 size', () => {
      expect(hasThumbnailAspectRatio(1920, 1080)).toBe(true);
    });

    it('should accept other 16:9 sizes', () => {
      expect(hasThumbnailAspectRatio(1280, 720)).toBe(true);
      expect(hasThumbnailAspectRatio(640, 360)).toBe(true);
    });

    it('should tolerate rounding to whole pixels', () => {
      expect(hasThumbnailAspectRatio(1000, 563)).toBe(true);
    });

    it('should reject other aspect ratios', () => {
      expect(hasThumbnailAspectRatio(1080, 1080)).toBe(false);
      expect(hasThumbnailAspectRatio(1600, 1200)).toBe(false);
      expect(hasThumbnailAspectRatio(1080, 1920)).toBe(false);
    });

    it('should reject degenerate sizes', () => {
      expect(hasThumbnailAspectRatio(0, 0)).toBe(false);
      expect(hasThumbnailAspectRatio(1920, 0)).toBe(false);
    });
  });

  describe('getThumbnailWarnings', () => {
    describe('when the thumbnail is a 16:9 png', () => {
      it('should return no warnings', () => {
        expect(
          getThumbnailWarnings('assets/scene/thumbnail.png', { width: 1920, height: 1080 }),
        ).toEqual([]);
      });
    });

    describe('when the dimensions are not known yet', () => {
      it('should not warn about the aspect ratio', () => {
        expect(getThumbnailWarnings('assets/scene/thumbnail.png', null)).toEqual([]);
      });
    });

    describe('when the thumbnail is not 16:9', () => {
      it('should warn with the actual size', () => {
        const warnings = getThumbnailWarnings('assets/scene/thumbnail.png', {
          width: 1080,
          height: 1080,
        });
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('1080×1080');
        expect(warnings[0]).toContain('16:9');
      });
    });

    describe('when the thumbnail is not a png or jpg', () => {
      it('should warn about the format', () => {
        const warnings = getThumbnailWarnings('assets/scene/thumbnail.gif', {
          width: 1920,
          height: 1080,
        });
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('.png');
        expect(warnings[0]).toContain('.jpg');
      });
    });
  });
});
