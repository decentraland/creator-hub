import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LandType, RoleType, type Land } from './land';

const fetchMock = vi.fn();

vi.mock('/shared/fetch', () => ({ fetch: (...args: unknown[]) => fetchMock(...args) }));

vi.mock('/@/config', () => ({
  config: {
    get: (key: string) => (key === 'BUILDER_SERVER_URL' ? 'https://builder.example.org/v1' : ''),
  },
}));

const { LandRedirections } = await import('./ens');

const reply = (body: unknown, ok = true) => ({
  ok,
  status: ok ? 200 : 500,
  json: () => Promise.resolve(body),
});

const land = (overrides: Partial<Land>): Land => ({
  id: '0,0',
  tokenId: '0',
  type: LandType.PARCEL,
  roles: [RoleType.OWNER],
  role: RoleType.OWNER,
  name: 'Parcel',
  description: null,
  owner: '0x1111111111111111111111111111111111111111',
  operators: [],
  ...overrides,
});

describe('LandRedirections', () => {
  afterEach(() => {
    fetchMock.mockReset();
  });

  describe('when creating the redirection for a parcel', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValue(
        reply({ ok: true, data: { ipfsHash: 'Qm', contentHash: 'e301ab' } }),
      );
    });

    it('should POST to the builder server so the file gets pinned', async () => {
      await new LandRedirections().create({ x: -3, y: 7 });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://builder.example.org/v1/lands/-3,7/redirection');
      expect(init.method).toBe('POST');
    });

    it('should resolve with the 0x-prefixed content hash', async () => {
      await expect(new LandRedirections().create({ x: -3, y: 7 })).resolves.toBe('0xe301ab');
    });
  });

  describe('when the builder server fails to create the redirection', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValue(reply({ ok: false, error: 'IPFS down' }, false));
    });

    it('should reject with the server error', async () => {
      await expect(new LandRedirections().create({ x: 0, y: 0 })).rejects.toThrow('IPFS down');
    });
  });

  describe('when fetching the hashes of a parcel and an estate', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValue(
        reply({
          ok: true,
          data: [
            { x: 1, y: 1, contentHash: 'AA' },
            { x: 5, y: 5, contentHash: 'bb' },
            { x: 6, y: 5, contentHash: 'cc' },
          ],
        }),
      );
    });

    it('should ask for every parcel, including each estate parcel', async () => {
      await new LandRedirections().fetchHashes([
        land({ id: '1,1', x: 1, y: 1 }),
        land({
          id: '7',
          type: LandType.ESTATE,
          parcels: [
            { x: 5, y: 5, id: '5,5', updateOperator: null },
            { x: 6, y: 5, id: '6,5', updateOperator: null },
          ],
        }),
      ]);

      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://builder.example.org/v1/lands/redirectionHashes?coords=1,1&coords=5,5&coords=6,5',
      );
    });

    it('should map each lowercased 0x hash to its land id', async () => {
      const hashes = await new LandRedirections().fetchHashes([
        land({ id: '1,1', x: 1, y: 1 }),
        land({
          id: '7',
          type: LandType.ESTATE,
          parcels: [
            { x: 5, y: 5, id: '5,5', updateOperator: null },
            { x: 6, y: 5, id: '6,5', updateOperator: null },
          ],
        }),
      ]);

      expect(hashes).toEqual({ '0xaa': '1,1', '0xbb': '7', '0xcc': '7' });
    });
  });

  describe('when there are more parcels than one request takes', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValue(reply({ ok: true, data: [] }));
    });

    it('should batch the requests', async () => {
      const lands = Array.from({ length: 250 }, (_, i) => land({ id: `${i},0`, x: i, y: 0 }));

      await new LandRedirections().fetchHashes(lands);

      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  describe('when the user has no LAND', () => {
    it('should not call the server', async () => {
      await expect(new LandRedirections().fetchHashes([])).resolves.toEqual({});
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
