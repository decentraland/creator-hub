import type { DeepReadonlyObject } from '@dcl/ecs';
import type { Scene } from '@dcl/schemas';

import type { EditorComponentsTypes } from '../../../sdk/components';
import { fromSceneComponent, toSceneComponent } from './component';

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
