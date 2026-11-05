import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Land } from './land';
import { LandType, RoleType } from './land';

const ENTITY_ID = 'bafkreiemptyscene';
const TIMESTAMP = 1_700_000_000_000;
const CSP_ERROR = new EvalError(
  "Evaluating a string as JavaScript violates the following Content Security Policy directive because 'unsafe-eval' is not an allowed source of script",
);

const prepareMock = vi.fn();
const deployMock = vi.fn();
const buildEntityMock = vi.fn(() => {
  throw CSP_ERROR;
});
const getIdentityMock = vi.fn();
const signPayloadMock = vi.fn((_identity: unknown, entityId: string) => [
  { type: 'SIGNER', payload: '0xme', signature: '' },
  { type: 'ECDSA_SIGNED_ENTITY', payload: entityId, signature: '0xsig' },
]);

vi.mock('#preload', () => ({
  env: { getEnv: () => 'dev' },
  landUnpublish: {
    prepare: (parcel: string) => prepareMock(parcel),
    deploy: (request: unknown) => deployMock(request),
  },
}));

vi.mock('dcl-catalyst-client', async importOriginal => {
  const original = (await importOriginal()) as { DeploymentBuilder: object };
  return {
    ...original,
    DeploymentBuilder: { ...original.DeploymentBuilder, buildEntity: buildEntityMock },
  };
});

vi.mock('@dcl/single-sign-on-client', () => ({
  localStorageGetIdentity: (address: string) => getIdentityMock(address),
}));

vi.mock('@dcl/crypto', async importOriginal => ({
  ...((await importOriginal()) as object),
  Authenticator: {
    signPayload: (identity: unknown, entityId: string) => signPayloadMock(identity, entityId),
  },
}));

const { pickUnpublishParcel, clearLandScene } = await import('./landUnpublish');

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
  updateOperator: null,
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
  updateOperator: null,
});

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

describe('clearLandScene', () => {
  const scene = { base: '0,0', parcels: ['0,0', '1,0'] };
  const identity = { ephemeralIdentity: {}, expiration: new Date(), authChain: [] };

  beforeEach(() => {
    prepareMock.mockResolvedValue({ entityId: ENTITY_ID, timestamp: TIMESTAMP });
    deployMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('when the account has a live identity and can deploy on a scene parcel', () => {
    beforeEach(async () => {
      getIdentityMock.mockReturnValue(identity);
      await clearLandScene(scene, [parcel(1, 0, RoleType.OWNER)], '0xme');
    });

    it('should ask the main process to build the empty scene over that parcel', () => {
      expect(prepareMock).toHaveBeenCalledWith('1,0');
    });

    it("should hand the main process the identity's signature over the entity it built", () => {
      expect(getIdentityMock).toHaveBeenCalledWith('0xme');
      expect(signPayloadMock).toHaveBeenCalledWith(identity, ENTITY_ID);
      expect(deployMock).toHaveBeenCalledWith({
        parcel: '1,0',
        timestamp: TIMESTAMP,
        authChain: signPayloadMock.mock.results[0].value,
      });
    });
  });

  describe("when the renderer's CSP stops the catalyst client from compiling its schema validator", () => {
    beforeEach(() => {
      getIdentityMock.mockReturnValue(identity);
    });

    it('should still unpublish, building the entity outside the renderer', async () => {
      await expect(
        clearLandScene(scene, [parcel(1, 0, RoleType.OWNER)], '0xme'),
      ).resolves.toBeUndefined();
      expect(buildEntityMock).not.toHaveBeenCalled();
      expect(deployMock).toHaveBeenCalled();
    });
  });

  describe('when the account has no live identity', () => {
    beforeEach(() => {
      getIdentityMock.mockReturnValue(null);
    });

    it('should fail without building or deploying anything', async () => {
      await expect(clearLandScene(scene, [parcel(1, 0, RoleType.OWNER)], '0xme')).rejects.toThrow();
      expect(prepareMock).not.toHaveBeenCalled();
      expect(deployMock).not.toHaveBeenCalled();
    });
  });

  describe('when the account can no longer deploy on any of the scene parcels', () => {
    beforeEach(() => {
      getIdentityMock.mockReturnValue(identity);
    });

    it('should fail without building or deploying anything', async () => {
      await expect(clearLandScene(scene, [parcel(5, 5, RoleType.OWNER)], '0xme')).rejects.toThrow();
      expect(prepareMock).not.toHaveBeenCalled();
      expect(deployMock).not.toHaveBeenCalled();
    });
  });

  describe('when the main process fails to deploy', () => {
    beforeEach(() => {
      getIdentityMock.mockReturnValue(identity);
      deployMock.mockRejectedValue(new Error('Catalyst answered 400: Invalid pointers'));
    });

    it('should fail with the catalyst error', async () => {
      await expect(clearLandScene(scene, [parcel(0, 0, RoleType.OWNER)], '0xme')).rejects.toThrow(
        'Catalyst answered 400: Invalid pointers',
      );
    });
  });
});
