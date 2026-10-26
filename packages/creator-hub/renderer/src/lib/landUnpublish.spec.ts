import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Scene } from '@dcl/schemas';

import type { Land } from './land';
import { LandType, RoleType } from './land';

type ContentClientOptions = {
  url: string;
  fetcher: { fetch: (url: string, init?: RequestInit) => Promise<Response> };
};

const fetchMock = vi.fn();
const deployMock = vi.fn();
const createContentClientMock = vi.fn((_options: ContentClientOptions) => ({
  deploy: deployMock,
}));
const getIdentityMock = vi.fn();
const signPayloadMock = vi.fn((_identity: unknown, entityId: string) => [
  { type: 'SIGNER', payload: '0xme', signature: '' },
  { type: 'ECDSA_SIGNED_ENTITY', payload: entityId, signature: '0xsig' },
]);

vi.mock('/@/config', () => ({
  config: { get: () => 'https://peer.example.org' },
}));

vi.mock('/shared/fetch', () => ({ fetch: (...args: unknown[]) => fetchMock(...args) }));

vi.mock('dcl-catalyst-client', async importOriginal => ({
  ...((await importOriginal()) as object),
  createContentClient: (options: ContentClientOptions) => createContentClientMock(options),
}));

vi.mock('@dcl/single-sign-on-client', () => ({
  localStorageGetIdentity: (address: string) => getIdentityMock(address),
}));

vi.mock('@dcl/crypto', async importOriginal => ({
  ...((await importOriginal()) as object),
  Authenticator: {
    signPayload: (identity: unknown, entityId: string) => signPayloadMock(identity, entityId),
  },
}));

const { buildEmptyScene, pickUnpublishParcel, clearLandScene } = await import('./landUnpublish');

const parcel = (x: number, y: number, role: RoleType): Land => ({
  id: `${x},${y}`,
  tokenId: `token-${x}-${y}`,
  type: LandType.PARCEL,
  roles: [role],
  role,
  x,
  y,
  name: 'Parcel',
  description: null,
  owner: '0xowner',
  operators: [],
});

const estate = (id: string, coords: Array<[number, number]>, role: RoleType): Land => ({
  id,
  tokenId: id,
  type: LandType.ESTATE,
  roles: [role],
  role,
  parcels: coords.map(([x, y]) => ({ x, y, id: `${x},${y}`, updateOperator: null })),
  name: `Estate ${id}`,
  description: null,
  owner: '0xowner',
  operators: [],
});

const decodeEntity = (files: Map<string, Uint8Array>, entityId: string) =>
  JSON.parse(new TextDecoder().decode(files.get(entityId)));

describe('pickUnpublishParcel', () => {
  const scene = { base: '0,0', parcels: ['0,0', '1,0', '2,0'] };

  describe('when the account can still deploy on the scene base parcel', () => {
    it('should pick the base parcel', () => {
      const lands = [
        estate(
          '7',
          [
            [0, 0],
            [1, 0],
            [2, 0],
          ],
          RoleType.OWNER,
        ),
      ];

      expect(pickUnpublishParcel(scene, lands)).toBe('0,0');
    });
  });

  describe('when the base parcel went to someone else, but another of the scene parcels did not', () => {
    it('should pick a parcel of the scene the account can deploy on', () => {
      const lands = [parcel(2, 0, RoleType.MANAGER)];

      expect(pickUnpublishParcel(scene, lands)).toBe('2,0');
    });
  });

  describe.each([
    ['owner', RoleType.OWNER],
    ['collaborator', RoleType.OPERATOR],
    ['manager', RoleType.MANAGER],
    ['tenant', RoleType.TENANT],
  ])('when the account is the %s of a scene parcel', (_name, role) => {
    it('should pick that parcel', () => {
      expect(pickUnpublishParcel(scene, [parcel(1, 0, role)])).toBe('1,0');
    });
  });

  describe('when the account only rents the scene parcels out', () => {
    it('should pick nothing, since the tenant holds the deploy rights', () => {
      expect(pickUnpublishParcel(scene, [parcel(0, 0, RoleType.LESSOR)])).toBeNull();
    });
  });

  describe('when none of the scene parcels belong to the account', () => {
    it('should pick nothing', () => {
      expect(pickUnpublishParcel(scene, [parcel(5, 5, RoleType.OWNER)])).toBeNull();
    });
  });
});

describe('buildEmptyScene', () => {
  describe('when building the empty scene for a parcel', () => {
    let entity: any;

    beforeEach(async () => {
      const { entityId, files } = await buildEmptyScene('4,-2');
      entity = decodeEntity(files, entityId);
    });

    it('should be a scene over that one parcel only', () => {
      expect(entity.type).toBe('scene');
      expect(entity.pointers).toEqual(['4,-2']);
      expect(entity.metadata.scene).toEqual({ base: '4,-2', parcels: ['4,-2'] });
    });

    it('should be an SDK7 scene whose main file is part of the deployment', () => {
      expect(entity.metadata.runtimeVersion).toBe('7');
      expect(entity.content.map((file: { file: string }) => file.file)).toContain(
        entity.metadata.main,
      );
    });

    it('should mark itself as empty, so it never reads as a published scene', () => {
      expect(entity.metadata.source).toMatchObject({ origin: 'creator-hub', isEmpty: true });
    });

    it('should carry metadata the catalyst accepts', () => {
      expect(Scene.validate(entity.metadata)).toBe(true);
      expect(entity.metadata.display).toBeDefined();
    });
  });
});

describe('clearLandScene', () => {
  const scene = { base: '0,0', parcels: ['0,0', '1,0'] };
  const identity = { ephemeralIdentity: {}, expiration: new Date(), authChain: [] };

  beforeEach(() => {
    deployMock.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('when the account has a live identity and can deploy on a scene parcel', () => {
    beforeEach(async () => {
      getIdentityMock.mockReturnValue(identity);
      await clearLandScene(scene, [parcel(1, 0, RoleType.OWNER)], '0xme');
    });

    it('should deploy to the configured catalyst', () => {
      expect(createContentClientMock).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://peer.example.org/content' }),
      );
    });

    it('should deploy the empty scene over that parcel, signed by the identity', () => {
      const [{ entityId, files, authChain }] = deployMock.mock.calls[0];

      expect(getIdentityMock).toHaveBeenCalledWith('0xme');
      expect(signPayloadMock).toHaveBeenCalledWith(identity, entityId);
      expect(authChain).toEqual(signPayloadMock.mock.results[0].value);
      expect(decodeEntity(files, entityId).pointers).toEqual(['1,0']);
    });
  });

  describe('when the account has no live identity', () => {
    beforeEach(() => {
      getIdentityMock.mockReturnValue(null);
    });

    it('should fail without deploying anything', async () => {
      await expect(clearLandScene(scene, [parcel(1, 0, RoleType.OWNER)], '0xme')).rejects.toThrow();
      expect(deployMock).not.toHaveBeenCalled();
    });
  });

  describe('when the account can no longer deploy on any of the scene parcels', () => {
    beforeEach(() => {
      getIdentityMock.mockReturnValue(identity);
    });

    it('should fail without deploying anything', async () => {
      await expect(clearLandScene(scene, [parcel(5, 5, RoleType.OWNER)], '0xme')).rejects.toThrow();
      expect(deployMock).not.toHaveBeenCalled();
    });
  });

  describe('when the catalyst answers with an error status', () => {
    let fetcher: ContentClientOptions['fetcher'];

    beforeEach(async () => {
      getIdentityMock.mockReturnValue(identity);
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Invalid pointers'),
      });
      await clearLandScene(scene, [parcel(0, 0, RoleType.OWNER)], '0xme');
      fetcher = createContentClientMock.mock.calls[0][0].fetcher;
    });

    it('should fail with what the catalyst said, rather than read it as deployed', async () => {
      await expect(fetcher.fetch('https://peer.example.org/content/entities')).rejects.toThrow(
        'Invalid pointers',
      );
    });
  });

  describe('when the catalyst rejects the deployment', () => {
    beforeEach(() => {
      getIdentityMock.mockReturnValue(identity);
      deployMock.mockRejectedValue(new Error('Catalyst answered 400'));
    });

    it('should fail with the catalyst error', async () => {
      await expect(clearLandScene(scene, [parcel(0, 0, RoleType.OWNER)], '0xme')).rejects.toThrow(
        'Catalyst answered 400',
      );
    });
  });
});
