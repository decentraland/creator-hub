import { beforeEach, describe, it, expect, vi } from 'vitest';
import { ChainId } from '@dcl/schemas';
import type { AuthIdentity } from 'decentraland-crypto-fetch';
import type * as SharedFetch from '/shared/fetch';
import type { DeploymentComponentsStatus, Info, Status } from '/@/lib/deploy';

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
const { checkDeploymentCompletion, fetchDeploymentStatus, getAvailableCatalystServer } =
  await import('./utils');

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

describe('checkDeploymentCompletion', () => {
  const status = (catalyst: Status, assetBundle: Status): DeploymentComponentsStatus => ({
    catalyst,
    assetBundle,
  });

  describe('when nothing has completed yet', () => {
    it('should not report the deployment as finishing', () => {
      expect(checkDeploymentCompletion(status('pending', 'idle'))).toBe(false);
    });
  });

  describe('when only the catalyst upload has completed', () => {
    // Two components, so the catalyst alone is 50% and misses the 60% default: the
    // in-progress "Jump In" must not appear until the asset bundles land.
    it('should not report the deployment as finishing', () => {
      expect(checkDeploymentCompletion(status('complete', 'pending'))).toBe(false);
    });
  });

  describe('when the asset bundles have completed too', () => {
    it('should report the deployment as finishing', () => {
      expect(checkDeploymentCompletion(status('complete', 'complete'))).toBe(true);
    });
  });

  describe('when a custom threshold is given', () => {
    it('should honour it instead of the 60% default', () => {
      expect(checkDeploymentCompletion(status('complete', 'pending'), 0.5)).toBe(true);
    });
  });

  describe('when the status carries no components', () => {
    it('should not report the deployment as finishing', () => {
      expect(checkDeploymentCompletion({} as DeploymentComponentsStatus)).toBe(false);
    });
  });
});
