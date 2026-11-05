import type { DeepReadonlyObject } from '@dcl/ecs';
import type { Scene } from '@dcl/schemas';

import type { EditorComponentsTypes, SceneSpawnPoint } from '../../../sdk/components';
import type * as ConfigModule from '../../../logic/config';
import {
  fromSceneComponent,
  fromSceneSpawnPoint,
  isSceneSpawnAxis,
  toSceneComponent,
  toSceneSpawnPoint,
} from './component';

const mocks = vi.hoisted(() => ({ authServerSupported: false }));

vi.mock('../../../logic/config', async orig => {
  const actual = await orig<typeof ConfigModule>();
  return {
    ...actual,
    getConfig: () => ({ ...actual.getConfig(), authServerSupported: mocks.authServerSupported }),
  };
});

type SceneWithMultiplayer = Partial<Scene> & {
  authoritativeMultiplayer?: boolean;
  logsPermissions?: string[];
};

const LAYOUT: EditorComponentsTypes['Scene']['layout'] = {
  parcels: [{ x: 0, y: 0 }],
  base: { x: 0, y: 0 },
};

const CHECKSUM_TRAP = '0xAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function getSceneComponent(
  layout: EditorComponentsTypes['Scene']['layout'],
  extra: Partial<EditorComponentsTypes['Scene']> = {},
): DeepReadonlyObject<EditorComponentsTypes['Scene']> {
  return {
    name: 'name',
    layout,
    ...extra,
  } as unknown as DeepReadonlyObject<EditorComponentsTypes['Scene']>;
}

function getScene(scene: Scene['scene'], extra: SceneWithMultiplayer = {}): Scene {
  return {
    main: 'bin/index.js',
    scene,
    ...extra,
  } as Scene;
}

beforeEach(() => {
  mocks.authServerSupported = false;
});

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

  describe('when the auth-server SDK is present', () => {
    beforeEach(() => {
      mocks.authServerSupported = true;
    });

    it('should write authoritativeMultiplayer true for a component with multiplayerServer on', () => {
      const result = fromSceneComponent(
        getSceneComponent(LAYOUT, { multiplayerServer: true }),
      ) as SceneWithMultiplayer;
      expect(result.authoritativeMultiplayer).toBe(true);
    });

    it('should keep a hand-written allowlist when authoritativeMultiplayer is explicitly false', () => {
      const result = fromSceneComponent(
        getSceneComponent(LAYOUT, {
          multiplayerServer: false,
          logsPermissions: ['0x0000000000000000000000000000000000000001'],
        }),
      ) as SceneWithMultiplayer;
      expect(result.logsPermissions).toEqual(['0x0000000000000000000000000000000000000001']);
    });

    it('should drop blank and malformed entries, normalise the prefix and de-duplicate', () => {
      const result = fromSceneComponent(
        getSceneComponent(LAYOUT, {
          multiplayerServer: true,
          logsPermissions: [
            '',
            'not-an-address',
            '0000000000000000000000000000000000000001',
            '0x0000000000000000000000000000000000000002',
            '0X0000000000000000000000000000000000000002',
          ],
        }),
      ) as SceneWithMultiplayer;
      expect(result.logsPermissions).toEqual([
        '0x0000000000000000000000000000000000000001',
        '0x0000000000000000000000000000000000000002',
      ]);
    });

    it('should remove the key when every entry is blank', () => {
      const result = fromSceneComponent(
        getSceneComponent(LAYOUT, { multiplayerServer: true, logsPermissions: [''] }),
      ) as SceneWithMultiplayer;
      expect('logsPermissions' in result).toBe(true);
      expect(result.logsPermissions).toBeUndefined();
    });

    it('should reject a bad-checksum address wherever it sits in the list', () => {
      const valid = '0x0000000000000000000000000000000000000001';
      expect(
        (
          fromSceneComponent(
            getSceneComponent(LAYOUT, {
              multiplayerServer: true,
              logsPermissions: [CHECKSUM_TRAP, valid],
            }),
          ) as SceneWithMultiplayer
        ).logsPermissions,
      ).toEqual([valid]);
      expect(
        (
          fromSceneComponent(
            getSceneComponent(LAYOUT, {
              multiplayerServer: true,
              logsPermissions: [valid, CHECKSUM_TRAP],
            }),
          ) as SceneWithMultiplayer
        ).logsPermissions,
      ).toEqual([valid]);
    });
  });

  describe('when an existing multiplayer scene is opened with the flag false', () => {
    it('should round-trip the allowlist instead of deleting it', () => {
      mocks.authServerSupported = false;
      const address = '0x0000000000000000000000000000000000000001';

      const opened = toSceneComponent(
        getScene({ parcels: ['0,0'], base: '0,0' }, {
          authoritativeMultiplayer: true,
          logsPermissions: [address],
        } as unknown as SceneWithMultiplayer),
      );
      const saved = fromSceneComponent(getSceneComponent(LAYOUT, opened));

      expect(opened.multiplayerServer).toBe(true);
      expect(saved.authoritativeMultiplayer).toBe(true);
      expect(saved.logsPermissions).toEqual([address]);
    });
  });

  describe('when the auth-server SDK is absent', () => {
    it('should still persist authoritativeMultiplayer, because the host cannot see that flag', () => {
      const result = fromSceneComponent(getSceneComponent(LAYOUT, { multiplayerServer: true }));
      expect(result.authoritativeMultiplayer).toBe(true);
    });

    it('should still persist the allowlist', () => {
      const address = '0x0000000000000000000000000000000000000001';
      const result = fromSceneComponent(
        getSceneComponent(LAYOUT, { multiplayerServer: true, logsPermissions: [address] }),
      );
      expect(result.logsPermissions).toEqual([address]);
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

  describe('when the scene has no authoritativeMultiplayer key', () => {
    it('should read as off even when the auth-server SDK is present, so the scene opts in explicitly', () => {
      mocks.authServerSupported = true;
      const result = toSceneComponent(getScene({ parcels: ['0,0'], base: '0,0' }));
      expect(result.multiplayerServer).toBe(false);
    });

    it('should read as off when the auth-server SDK is absent', () => {
      const result = toSceneComponent(getScene({ parcels: ['0,0'], base: '0,0' }));
      expect(result.multiplayerServer).toBe(false);
    });
  });

  describe('when the scene has an explicit authoritativeMultiplayer false', () => {
    it('should read as off even when the auth-server SDK is present', () => {
      mocks.authServerSupported = true;
      const result = toSceneComponent(
        getScene({ parcels: ['0,0'], base: '0,0' }, { authoritativeMultiplayer: false }),
      );
      expect(result.multiplayerServer).toBe(false);
    });
  });

  describe('when scene.json holds an entry the write path would reject', () => {
    it('should not surface it, so the panel cannot show access it never granted', () => {
      const result = toSceneComponent(
        getScene({ parcels: ['0,0'], base: '0,0' }, {
          logsPermissions: ['0x5aAeb6053f3e94c9b9a09f33669435e7ef1beaed'],
        } as unknown as SceneWithMultiplayer),
      );
      expect(result.logsPermissions).toEqual([]);
    });

    it('should surface an entry the write path keeps', () => {
      const address = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed';
      const result = toSceneComponent(
        getScene({ parcels: ['0,0'], base: '0,0' }, {
          logsPermissions: [address],
        } as unknown as SceneWithMultiplayer),
      );
      expect(result.logsPermissions).toEqual([address]);
    });
  });

  describe('when scene.json has a malformed logsPermissions', () => {
    it('should ignore a non-array value instead of exploding it into characters', () => {
      const result = toSceneComponent(
        getScene({ parcels: ['0,0'], base: '0,0' }, {
          logsPermissions: '0x0000000000000000000000000000000000000001',
        } as unknown as SceneWithMultiplayer),
      );
      expect(result.logsPermissions).toEqual([]);
    });

    it('should not throw on a non-iterable value', () => {
      expect(() =>
        toSceneComponent(
          getScene({ parcels: ['0,0'], base: '0,0' }, {
            logsPermissions: 5,
          } as unknown as SceneWithMultiplayer),
        ),
      ).not.toThrow();
    });

    it('should drop non-string entries from an array', () => {
      const result = toSceneComponent(
        getScene({ parcels: ['0,0'], base: '0,0' }, {
          logsPermissions: ['0x0000000000000000000000000000000000000001', 5, null],
        } as unknown as SceneWithMultiplayer),
      );
      expect(result.logsPermissions).toEqual(['0x0000000000000000000000000000000000000001']);
    });
  });

  describe('when scene.json has spawn ranges alongside multiplayer and logs permissions', () => {
    it('should read and write every field back unchanged', () => {
      mocks.authServerSupported = true;
      const address = '0x0000000000000000000000000000000000000001';
      const spawnPoints = [
        {
          name: 'Range',
          default: true,
          position: { x: [1, 3], y: [0, 0], z: [2, 4] },
          cameraTarget: { x: 8, y: 1, z: 8 },
        },
        { name: 'Single', position: { x: 5, y: 0, z: 6 } },
      ] as NonNullable<Scene['spawnPoints']>;
      const sceneJson = getScene(
        { parcels: ['0,0'], base: '0,0' },
        { spawnPoints, authoritativeMultiplayer: true, logsPermissions: [address] },
      );

      const component = toSceneComponent(sceneJson);
      expect(component.multiplayerServer).toBe(true);
      expect(component.logsPermissions).toEqual([address]);
      expect(component.spawnPoints?.[0].position.x).toEqual({ $case: 'range', value: [1, 3] });
      expect(component.spawnPoints?.[1].position.x).toEqual({ $case: 'single', value: 5 });

      const written = fromSceneComponent(
        component as DeepReadonlyObject<EditorComponentsTypes['Scene']>,
      ) as SceneWithMultiplayer;
      expect(written.authoritativeMultiplayer).toBe(true);
      expect(written.logsPermissions).toEqual([address]);
      expect(written.spawnPoints?.map(({ name, position }) => ({ name, position }))).toEqual([
        { name: 'Range', position: { x: [1, 3], y: [0, 0], z: [2, 4] } },
        { name: 'Single', position: { x: 5, y: 0, z: 6 } },
      ]);
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
