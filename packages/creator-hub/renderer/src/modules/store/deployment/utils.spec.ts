import { beforeEach, describe, it, expect, vi } from 'vitest';
import { ChainId } from '@dcl/schemas';
import type { AuthIdentity } from 'decentraland-crypto-fetch';
import type * as SharedFetch from '/shared/fetch';
import type { DeploymentComponentsStatus, Info } from '/@/lib/deploy';

const REGISTRY = 'https://asset-bundle-registry.example.org';
const ABGEN_REGISTRY = 'https://asset-bundle-registry-abgen.example.org';

const fetchMock = vi.fn();
const fetchWorldLimitsMock = vi.fn();

vi.mock('/@/config', () => ({
  config: {
    get: (key: string) => (key === 'ASSET_BUNDLE_REGISTRY_ABGEN_URL' ? ABGEN_REGISTRY : REGISTRY),
  },
}));

vi.mock('/shared/fetch', async importOriginal => ({
  ...(await importOriginal<typeof SharedFetch>()),
  fetch: (...args: unknown[]) => fetchMock(...args),
}));

vi.mock('@dcl/crypto', () => ({
  Authenticator: {
    signPayload: vi.fn(() => [{ type: 'SIGNER', payload: '0xtest', signature: '' }]),
  },
}));

vi.mock('dcl-catalyst-client/dist/contracts-snapshots', () => ({
  getCatalystServersFromCache: vi.fn((network: string) => {
    switch (network) {
      case 'sepolia':
        return [
          { address: 'https://peer.decentraland.zone' },
          { address: 'https://peer-ec2.decentraland.zone' },
        ];
      default:
        return [
          { address: 'https://peer.decentraland.org' },
          { address: 'https://peer-ec2.decentraland.org' },
        ];
    }
  }),
}));

vi.mock('/@/lib/worlds', () => ({
  Worlds: class {
    fetchWorldLimits = fetchWorldLimitsMock;
  },
}));

// Imported after the mocks: `utils` reads the registry hosts from config at module load.
const { fetchDeploymentStatus, fetchSceneSizeLimit, getAvailableCatalystServer } = await import(
  './utils'
);

describe('getAvailableCatalystServer', () => {
  it('should return a server for sepolia network', () => {
    const triedServers = new Set<string>();
    const result = getAvailableCatalystServer(triedServers, ChainId.ETHEREUM_SEPOLIA);

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should return a server for mainnet network', () => {
    const triedServers = new Set<string>();
    const result = getAvailableCatalystServer(triedServers, ChainId.ETHEREUM_MAINNET);

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should exclude tried servers from the selection', () => {
    const triedServers = new Set<string>();
    const firstResult = getAvailableCatalystServer(triedServers, ChainId.ETHEREUM_SEPOLIA);
    triedServers.add(firstResult);
    const secondResult = getAvailableCatalystServer(triedServers, ChainId.ETHEREUM_SEPOLIA);
    triedServers.add(secondResult);

    expect(triedServers).toContain(firstResult);
    expect(triedServers).toContain(secondResult);
  });

  describe('when no servers in cache', () => {
    it('should throw error', () => {
      const triedServers = new Set<string>([
        'https://peer.decentraland.zone',
        'https://peer-ec2.decentraland.zone',
      ]);

      expect(() => getAvailableCatalystServer(triedServers, ChainId.ETHEREUM_SEPOLIA)).toThrow(
        'No available catalyst servers to try',
      );
    });
  });
});

describe('fetchDeploymentStatus', () => {
  const SCENE_ID = 'QmScene123';
  const statusUrl = (registry: string) => `${registry}/entities/status/${SCENE_ID}`;
  const requestedUrls = () => fetchMock.mock.calls.map(([url]) => url.toString());

  /** The registry's `/entities/status/:id` body, pending everywhere unless overridden. */
  const registryResponse = (overrides: Record<string, unknown> = {}) => ({
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        complete: false,
        catalyst: 'complete',
        assetBundles: { mac: 'pending', windows: 'pending' },
        lods: { mac: 'pending', windows: 'pending' },
        ...overrides,
      }),
  });

  const bothPlatforms = (status: string) => ({ mac: status, windows: status });

  let identity: AuthIdentity;
  let info: Info;
  let status: DeploymentComponentsStatus;

  beforeEach(() => {
    fetchMock.mockReset();
    identity = {} as AuthIdentity;
    info = { rootCID: SCENE_ID } as Info;
  });

  describe('when the abgen pipeline is off', () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValue(registryResponse({ assetBundles: bothPlatforms('complete') }));
      status = await fetchDeploymentStatus(info, identity, false);
    });

    it('should read the status from the regular registry in a single request', () => {
      expect(requestedUrls()).toEqual([statusUrl(REGISTRY)]);
    });

    it('should derive both statuses from that response', () => {
      expect(status).toEqual({ catalyst: 'complete', assetBundle: 'complete' });
    });
  });

  describe('when the abgen pipeline is on', () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValue(registryResponse({ assetBundles: bothPlatforms('complete') }));
      status = await fetchDeploymentStatus(info, identity, true);
    });

    it('should read the status from the abgen registry alone', () => {
      expect(requestedUrls()).toEqual([statusUrl(ABGEN_REGISTRY)]);
    });

    it('should derive both statuses from that response', () => {
      expect(status).toEqual({ catalyst: 'complete', assetBundle: 'complete' });
    });
  });

  describe('when the registry still reports the lods as pending', () => {
    it('should report the deployment as complete, since lods are not a component', async () => {
      fetchMock.mockResolvedValue(
        registryResponse({
          assetBundles: bothPlatforms('complete'),
          lods: bothPlatforms('pending'),
        }),
      );

      await expect(fetchDeploymentStatus(info, identity, true)).resolves.toEqual({
        catalyst: 'complete',
        assetBundle: 'complete',
      });
    });
  });

  describe('when the registry does not know the entity yet', () => {
    let cancelErrorBody: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      cancelErrorBody = vi.fn().mockResolvedValue(undefined);
      fetchMock.mockResolvedValue({ ok: false, status: 404, body: { cancel: cancelErrorBody } });
    });

    it('should reject so the caller retries instead of reporting a partial status', async () => {
      await expect(fetchDeploymentStatus(info, identity, true)).rejects.toThrow(
        'Error fetching deployment status: 404',
      );
    });

    it('should release the error body rather than leave it to the collector', async () => {
      await fetchDeploymentStatus(info, identity, true).catch(() => undefined);

      expect(cancelErrorBody).toHaveBeenCalled();
    });
  });
});

describe('fetchSceneSizeLimit', () => {
  const MiB = 1024 * 1024;
  const PARCELS = ['0,0', '0,1', '1,0'];

  let target: Parameters<typeof fetchSceneSizeLimit>[0];
  let limit: number | null;

  beforeEach(() => {
    fetchWorldLimitsMock.mockReset();
  });

  describe('when publishing to Genesis City', () => {
    beforeEach(async () => {
      target = { isWorld: false, parcels: PARCELS };
      limit = await fetchSceneSizeLimit(target);
    });

    it('should allow 15 MiB per parcel', () => {
      expect(limit).toBe(3 * 15 * MiB);
    });

    it('should not ask the worlds server', () => {
      expect(fetchWorldLimitsMock).not.toHaveBeenCalled();
    });
  });

  describe('when publishing to a world', () => {
    beforeEach(() => {
      target = { isWorld: true, worldName: 'name.dcl.eth', parcels: PARCELS };
    });

    describe('and the worlds server reports its limits', () => {
      beforeEach(async () => {
        fetchWorldLimitsMock.mockResolvedValueOnce({
          maxSceneSizeInBytes: 200 * MiB,
          maxParcels: 100,
        });
        limit = await fetchSceneSizeLimit(target);
      });

      it("should ask for the limits of the scene's world and parcels", () => {
        expect(fetchWorldLimitsMock).toHaveBeenCalledWith('name.dcl.eth', PARCELS);
      });

      it("should use the server's scene size limit", () => {
        expect(limit).toBe(200 * MiB);
      });
    });

    describe('and the worlds server cannot report its limits', () => {
      beforeEach(async () => {
        fetchWorldLimitsMock.mockResolvedValueOnce(null);
        limit = await fetchSceneSizeLimit(target);
      });

      it('should report the limit as unknown', () => {
        expect(limit).toBeNull();
      });
    });

    describe('and the world has no name', () => {
      beforeEach(async () => {
        target = { isWorld: true, parcels: PARCELS };
        limit = await fetchSceneSizeLimit(target);
      });

      it('should report the limit as unknown without asking the worlds server', () => {
        expect(limit).toBeNull();
        expect(fetchWorldLimitsMock).not.toHaveBeenCalled();
      });
    });
  });
});
