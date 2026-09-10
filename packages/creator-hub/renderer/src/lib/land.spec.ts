import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Coords } from './land';

const fetchMock = vi.fn();

vi.mock('/shared/fetch', () => ({ fetch: (...args: unknown[]) => fetchMock(...args) }));

vi.mock('/@/config', () => ({
  config: { get: () => 'https://peer.example.org' },
}));

const { Lands } = await import('./land');

const ok = (scenes: Array<{ id: string }>) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(scenes),
});

const parcels = (count: number): Coords[] =>
  Array.from({ length: count }, (_, i): Coords => [i, 0]);

describe('Lands.fetchLandPublishedScenes', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('when a scene covers several of the owned parcels', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValue(ok([{ id: 'scene-a' }, { id: 'scene-a' }, { id: 'scene-b' }]));
    });

    it('should answer once per scene rather than once per parcel', async () => {
      const scenes = await new Lands().fetchLandPublishedScenes(parcels(3));

      expect(scenes.map(scene => scene.id)).toEqual(['scene-a', 'scene-b']);
    });
  });

  describe('when the wallet holds more parcels than one request takes', () => {
    beforeEach(() => {
      fetchMock.mockImplementation(() => Promise.resolve(ok([{ id: 'scene-a' }])));
    });

    it('should ask in batches and declare the body as JSON', async () => {
      await new Lands().fetchLandPublishedScenes(parcels(250));

      expect(fetchMock).toHaveBeenCalledTimes(3);
      const [, init] = fetchMock.mock.calls[0];
      expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
      expect(JSON.parse(init.body).pointers).toHaveLength(100);
    });

    it('should allow longer than the default timeout, which a cold batch outlasts', async () => {
      await new Lands().fetchLandPublishedScenes(parcels(100));

      const [, , timeoutMs] = fetchMock.mock.calls[0];
      expect(timeoutMs).toBeGreaterThan(5000);
    });
  });

  describe('when a batch fails once', () => {
    beforeEach(() => {
      fetchMock
        .mockRejectedValueOnce(new Error('REQUEST_TIMEOUT'))
        .mockResolvedValue(ok([{ id: 'scene-a' }]));
    });

    it('should ask again rather than dropping those parcels', async () => {
      const scenes = await new Lands().fetchLandPublishedScenes(parcels(10));

      expect(scenes.map(scene => scene.id)).toEqual(['scene-a']);
    });
  });

  describe('when a batch keeps failing', () => {
    it('should throw, so the parcels are never silently missing from the list', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 503 });

      await expect(new Lands().fetchLandPublishedScenes(parcels(10))).rejects.toThrow();
    });

    it('should throw when the request itself keeps erroring', async () => {
      fetchMock.mockRejectedValue(new Error('REQUEST_TIMEOUT'));

      await expect(new Lands().fetchLandPublishedScenes(parcels(10))).rejects.toThrow(
        'REQUEST_TIMEOUT',
      );
    });
  });

  describe('when the wallet holds no parcels', () => {
    it('should ask for nothing', async () => {
      expect(await new Lands().fetchLandPublishedScenes([])).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
