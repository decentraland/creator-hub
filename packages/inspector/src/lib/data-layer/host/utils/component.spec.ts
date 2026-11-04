import type { DeepReadonlyObject } from '@dcl/ecs';
import type { Scene } from '@dcl/schemas';

import type { EditorComponentsTypes, SceneSpawnPoint } from '../../../sdk/components';
import {
  fromSceneComponent,
  fromSceneSpawnPoint,
  isSceneSpawnAxis,
  toSceneComponent,
  toSceneSpawnPoint,
} from './component';

function getSceneComponent(
  layout: EditorComponentsTypes['Scene']['layout'],
): DeepReadonlyObject<EditorComponentsTypes['Scene']> {
  return {
    name: 'name',
    layout,
  } as unknown as DeepReadonlyObject<EditorComponentsTypes['Scene']>;
}

function getScene(scene: Scene['scene']): Scene {
  return {
    main: 'bin/index.js',
    scene,
  } as Scene;
}

describe('fromSceneComponent', () => {
  describe('when the layout has parcels', () => {
    it('should map the parcels and base to their string representation', () => {
      const result = fromSceneComponent(
        getSceneComponent({
          parcels: [
            { x: 0, y: 0 },
            { x: 0, y: 1 },
          ],
          base: { x: 0, y: 0 },
        }),
      );
      expect(result.scene).toEqual({ parcels: ['0,0', '0,1'], base: '0,0' });
    });
  });

  describe('when the layout has no parcels', () => {
    it('should fall back to a single parcel at the base coordinates', () => {
      const result = fromSceneComponent(getSceneComponent({ parcels: [], base: { x: 2, y: 3 } }));
      expect(result.scene).toEqual({ parcels: ['2,3'], base: '2,3' });
    });
  });

  describe('when the layout has no parcels and no base', () => {
    it('should fall back to a single parcel at 0,0', () => {
      const result = fromSceneComponent(
        getSceneComponent({ parcels: [] } as unknown as EditorComponentsTypes['Scene']['layout']),
      );
      expect(result.scene).toEqual({ parcels: ['0,0'], base: '0,0' });
    });
  });
});

describe('toSceneComponent', () => {
  describe('when the scene has parcels', () => {
    it('should parse the parcels and base into coordinates', () => {
      const result = toSceneComponent(getScene({ parcels: ['0,0', '0,1'], base: '0,0' }));
      expect(result.layout).toEqual({
        parcels: [
          { x: 0, y: 0 },
          { x: 0, y: 1 },
        ],
        base: { x: 0, y: 0 },
      });
    });
  });

  describe('when the scene has no parcels', () => {
    it('should fall back to a single parcel at the base coordinates', () => {
      const result = toSceneComponent(getScene({ parcels: [], base: '2,3' }));
      expect(result.layout).toEqual({ parcels: [{ x: 2, y: 3 }], base: { x: 2, y: 3 } });
    });
  });

  describe('when the scene has parcels with the wrong type', () => {
    it('should drop the invalid parcels and fall back to the base coordinates', () => {
      const result = toSceneComponent(
        getScene({ parcels: [0, 0], base: '2,3' } as unknown as Scene['scene']),
      );
      expect(result.layout).toEqual({ parcels: [{ x: 2, y: 3 }], base: { x: 2, y: 3 } });
    });

    it('should keep the valid parcels and drop the invalid ones', () => {
      const result = toSceneComponent(
        getScene({ parcels: ['1,1', 0, 'not-a-parcel'], base: '1,1' } as unknown as Scene['scene']),
      );
      expect(result.layout).toEqual({ parcels: [{ x: 1, y: 1 }], base: { x: 1, y: 1 } });
    });
  });

  describe('when the scene has an invalid base', () => {
    it('should fall back to the first valid parcel', () => {
      const result = toSceneComponent(
        getScene({ parcels: ['5,5'], base: 7 } as unknown as Scene['scene']),
      );
      expect(result.layout).toEqual({ parcels: [{ x: 5, y: 5 }], base: { x: 5, y: 5 } });
    });
  });

  describe('when the scene has no parcels and no base', () => {
    it('should fall back to a single parcel at 0,0', () => {
      const result = toSceneComponent(getScene({ parcels: [] } as unknown as Scene['scene']));
      expect(result.layout).toEqual({ parcels: [{ x: 0, y: 0 }], base: { x: 0, y: 0 } });
    });
  });
});

describe('fromSceneSpawnPoint', () => {
  describe('when every axis is a range', () => {
    it('should return every axis as a [min, max] array', () => {
      const result = fromSceneSpawnPoint({
        name: 'A',
        default: true,
        position: {
          x: { $case: 'range', value: [1, 2] },
          y: { $case: 'range', value: [0, 0] },
          z: { $case: 'range', value: [3, 4] },
        },
        cameraTarget: { x: 1, y: 2, z: 3 },
      });
      expect(result).toEqual({
        name: 'A',
        default: true,
        position: { x: [1, 2], y: [0, 0], z: [3, 4] },
        cameraTarget: { x: 1, y: 2, z: 3 },
      });
    });
  });

  describe('when every axis is a single value', () => {
    it('should return every axis as a number', () => {
      const result = fromSceneSpawnPoint({
        name: 'B',
        position: {
          x: { $case: 'single', value: 8 },
          y: { $case: 'single', value: 0 },
          z: { $case: 'single', value: 8 },
        },
      });
      expect(result).toEqual({
        name: 'B',
        default: undefined,
        position: { x: 8, y: 0, z: 8 },
        cameraTarget: undefined,
      });
    });
  });

  describe('when ranges and single values are mixed', () => {
    it('should return the single values as [v, v] arrays', () => {
      const result = fromSceneSpawnPoint({
        name: 'C',
        position: {
          x: { $case: 'range', value: [1, 2] },
          y: { $case: 'single', value: 5 },
          z: { $case: 'single', value: 7 },
        },
      });
      expect(result.position).toEqual({ x: [1, 2], y: [5, 5], z: [7, 7] });
    });
  });
});

describe('toSceneSpawnPoint', () => {
  describe('when the axes are [min, max] arrays', () => {
    it('should return range cases', () => {
      const result: SceneSpawnPoint = toSceneSpawnPoint(
        { name: 'A', default: true, position: { x: [1, 2], y: [0, 0], z: [3, 4] } },
        0,
      );
      expect(result.position).toEqual({
        x: { $case: 'range', value: [1, 2] },
        y: { $case: 'range', value: [0, 0] },
        z: { $case: 'range', value: [3, 4] },
      });
    });
  });

  describe('when the axes are numbers', () => {
    it('should return single cases', () => {
      const result = toSceneSpawnPoint({ name: 'B', position: { x: 8, y: 0, z: 8 } }, 0);
      expect(result.position).toEqual({
        x: { $case: 'single', value: 8 },
        y: { $case: 'single', value: 0 },
        z: { $case: 'single', value: 8 },
      });
    });
  });

  describe('when the spawn point has no name', () => {
    it('should name it after its index', () => {
      const result = toSceneSpawnPoint(
        { position: { x: 1, y: 0, z: 1 } } as NonNullable<Scene['spawnPoints']>[number],
        2,
      );
      expect(result.name).toBe('Spawn Point 3');
    });
  });
});

describe('isSceneSpawnAxis', () => {
  describe('when the value is a finite number', () => {
    it('should return true', () => {
      expect(isSceneSpawnAxis(4.5)).toBe(true);
    });
  });

  describe('when the value is a pair of finite numbers', () => {
    it('should return true', () => {
      expect(isSceneSpawnAxis([1, 2])).toBe(true);
    });
  });

  describe('when the value is NaN', () => {
    it('should return false', () => {
      expect(isSceneSpawnAxis(NaN)).toBe(false);
    });
  });

  describe('when the value is a numeric string', () => {
    it('should return false', () => {
      expect(isSceneSpawnAxis('1')).toBe(false);
    });
  });

  describe('when the value is an array of one number', () => {
    it('should return false', () => {
      expect(isSceneSpawnAxis([1])).toBe(false);
    });
  });

  describe('when the value is an array of three numbers', () => {
    it('should return false', () => {
      expect(isSceneSpawnAxis([1, 2, 3])).toBe(false);
    });
  });
});
