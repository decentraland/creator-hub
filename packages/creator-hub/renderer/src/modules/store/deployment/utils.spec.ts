import { beforeEach, describe, it, expect, vi } from 'vitest';
import { ChainId } from '@dcl/schemas';
import type { AuthIdentity } from 'decentraland-crypto-fetch';
import type * as SharedFetch from '/shared/fetch';
import type { DeploymentComponentsStatus, Info } from '/@/lib/deploy';

const REGISTRY = 'https://asset-bundle-registry.example.org';
const ABGEN_REGISTRY = 'https://asset-bundle-registry-abgen.example.org';

const fetchMock = vi.fn();

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

// Imported after the mocks: `utils` reads the registry hosts from config at module load.
const { fetchDeploymentStatus, getAvailableCatalystServer } = await import('./utils');

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
    info = { rootCID: SCENE_ID, isWorld: false } as Info;
  });

  describe('when the abgen pipeline is off', () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValue(
        registryResponse({
          assetBundles: bothPlatforms('complete'),
          lods: bothPlatforms('complete'),
        }),
      );
      status = await fetchDeploymentStatus(info, identity, false);
    });

    it('should read every component from the regular registry in a single request', () => {
      expect(requestedUrls()).toEqual([statusUrl(REGISTRY)]);
    });

    it('should derive all three statuses from that response', () => {
      expect(status).toEqual({
        catalyst: 'complete',
        assetBundle: 'complete',
        lods: 'complete',
      });
    });
  });

  describe('when the abgen pipeline is on', () => {
    describe('and the scene is not a world', () => {
      beforeEach(async () => {
        // Only the abgen registry has the bundles; only the regular one has the LODs.
        fetchMock.mockImplementation((url: URL) =>
          url.toString().startsWith(ABGEN_REGISTRY)
            ? registryResponse({ assetBundles: bothPlatforms('complete') })
            : registryResponse({ lods: bothPlatforms('complete') }),
        );
        status = await fetchDeploymentStatus(info, identity, true);
      });

      it('should ask both registries about the same entity', () => {
        expect(requestedUrls()).toEqual([statusUrl(ABGEN_REGISTRY), statusUrl(REGISTRY)]);
      });

      it('should take the asset bundle status from the abgen registry', () => {
        expect(status.assetBundle).toBe('complete');
      });

      it('should take the lods status from the regular registry', () => {
        expect(status.lods).toBe('complete');
      });
    });

    describe('and the scene is a world', () => {
      beforeEach(async () => {
        info = { rootCID: SCENE_ID, isWorld: true } as Info;
        fetchMock.mockResolvedValue(registryResponse({ assetBundles: bothPlatforms('complete') }));
        status = await fetchDeploymentStatus(info, identity, true);
      });

      it('should not ask the regular registry for lods it never needs', () => {
        expect(requestedUrls()).toEqual([statusUrl(ABGEN_REGISTRY)]);
      });

      it('should report the lods as complete', () => {
        expect(status.lods).toBe('complete');
      });
    });

    describe('and the regular registry does not know the entity yet', () => {
      beforeEach(() => {
        fetchMock.mockImplementation((url: URL) =>
          url.toString().startsWith(ABGEN_REGISTRY)
            ? registryResponse({ assetBundles: bothPlatforms('complete') })
            : { ok: false, status: 404 },
        );
      });

      it('should reject so the caller retries instead of reporting a partial status', async () => {
        await expect(fetchDeploymentStatus(info, identity, true)).rejects.toThrow(
          'Error fetching deployment status: 404',
        );
      });
    });
  });
});
