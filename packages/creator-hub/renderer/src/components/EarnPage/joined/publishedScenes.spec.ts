import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Project, ProjectDeployment } from '/shared/types/projects';

import { Lands, type LandDeployment } from '/@/lib/land';
import type * as LandModule from '/@/lib/land';
import { Worlds, type WorldScenes } from '/@/lib/worlds';

import { findPublishedPaths } from './publishedScenes';

vi.mock('/@/lib/land', async importOriginal => ({
  ...(await importOriginal<typeof LandModule>()),
  Lands: vi.fn(),
}));
vi.mock('/@/lib/worlds', () => ({ Worlds: vi.fn() }));
Lands.prototype.fetchLandPublishedScenes = vi.fn();
Worlds.prototype.fetchWorldScenes = vi.fn();

const landRecord = (parcel: string, deploymentHash: string): ProjectDeployment => ({
  publishedAt: 1,
  deploymentHash,
  parcel,
});

const worldRecord = (
  worldName: string,
  parcel: string,
  deploymentHash: string,
): ProjectDeployment => ({ ...landRecord(parcel, deploymentHash), worldName });

const project = (path: string, records: ProjectDeployment[] = []) =>
  ({
    path,
    info: {
      id: path,
      skipPublishWarning: false,
      deployments: Object.fromEntries(
        records.map(record => [
          record.worldName ? `world:${record.worldName}:${record.parcel}` : `land:${record.parcel}`,
          record,
        ]),
      ),
    },
  }) as Project;

const activeLand = (...ids: string[]) => ids.map(id => ({ id }) as LandDeployment);

const activeWorld = (...ids: string[]) =>
  ({ scenes: ids.map(entityId => ({ entityId })), total: ids.length }) as WorldScenes;

describe('findPublishedPaths', () => {
  beforeEach(() => {
    vi.mocked(Lands.prototype.fetchLandPublishedScenes).mockResolvedValue([]);
    vi.mocked(Worlds.prototype.fetchWorldScenes).mockResolvedValue(activeWorld());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('when no scene has a publish record', () => {
    it('should count none as published and ask no content server', async () => {
      expect(await findPublishedPaths([project('/a'), project('/b')])).toEqual(new Set());
      expect(Lands.prototype.fetchLandPublishedScenes).not.toHaveBeenCalled();
      expect(Worlds.prototype.fetchWorldScenes).not.toHaveBeenCalled();
    });
  });

  describe('when scenes were published on LAND', () => {
    const projects = [
      project('/live', [landRecord('1,2', 'bafy-live')]),
      project('/replaced', [landRecord('3,4', 'bafy-old')]),
      project('/never'),
    ];

    it('should ask the catalyst once for every recorded parcel', async () => {
      await findPublishedPaths(projects);

      expect(Lands.prototype.fetchLandPublishedScenes).toHaveBeenCalledTimes(1);
      expect(Lands.prototype.fetchLandPublishedScenes).toHaveBeenCalledWith([
        [1, 2],
        [3, 4],
      ]);
    });

    it('should count a scene published only while its recorded entity is still active', async () => {
      vi.mocked(Lands.prototype.fetchLandPublishedScenes).mockResolvedValue(
        activeLand('bafy-live', 'bafy-someone-else'),
      );

      expect(await findPublishedPaths(projects)).toEqual(new Set(['/live']));
    });

    it('should trust every LAND record when the catalyst lookup fails', async () => {
      vi.mocked(Lands.prototype.fetchLandPublishedScenes).mockRejectedValue(new Error('down'));

      expect(await findPublishedPaths(projects)).toEqual(new Set(['/live', '/replaced']));
    });
  });

  describe('when scenes were published in Worlds', () => {
    const projects = [
      project('/a', [worldRecord('alpha.dcl.eth', '0,0', 'bafy-a')]),
      project('/b', [worldRecord('alpha.dcl.eth', '2,3', 'bafy-b')]),
      project('/c', [worldRecord('beta.dcl.eth', '0,0', 'bafy-c')]),
    ];

    it('should ask each World once, over the box of its recorded parcels', async () => {
      await findPublishedPaths(projects);

      expect(Worlds.prototype.fetchWorldScenes).toHaveBeenCalledTimes(2);
      expect(Worlds.prototype.fetchWorldScenes).toHaveBeenCalledWith('alpha.dcl.eth', {
        limit: 100,
        offset: 0,
        x1: 0,
        x2: 2,
        y1: 0,
        y2: 3,
      });
      expect(Worlds.prototype.fetchWorldScenes).toHaveBeenCalledWith('beta.dcl.eth', {
        limit: 100,
        offset: 0,
        x1: 0,
        x2: 0,
        y1: 0,
        y2: 0,
      });
    });

    it('should count a scene published only while its recorded entity is still active', async () => {
      vi.mocked(Worlds.prototype.fetchWorldScenes).mockImplementation(async worldName =>
        worldName === 'alpha.dcl.eth' ? activeWorld('bafy-a', 'bafy-other') : activeWorld(),
      );

      expect(await findPublishedPaths(projects)).toEqual(new Set(['/a']));
    });

    it("should trust a World's records when its answer fills the page limit", async () => {
      vi.mocked(Worlds.prototype.fetchWorldScenes).mockImplementation(async worldName =>
        worldName === 'alpha.dcl.eth'
          ? activeWorld(...Array.from({ length: 100 }, (_, index) => `bafy-other-${index}`))
          : activeWorld(),
      );

      expect(await findPublishedPaths(projects)).toEqual(new Set(['/a', '/b']));
    });

    it("should trust a World's records when its lookup fails", async () => {
      vi.mocked(Worlds.prototype.fetchWorldScenes).mockImplementation(async worldName =>
        worldName === 'beta.dcl.eth' ? null : activeWorld(),
      );

      expect(await findPublishedPaths(projects)).toEqual(new Set(['/c']));
    });
  });

  describe('when a scene was published to several targets', () => {
    it('should count it published while any one of them is still live', async () => {
      vi.mocked(Worlds.prototype.fetchWorldScenes).mockResolvedValue(activeWorld('bafy-w'));

      expect(
        await findPublishedPaths([
          project('/multi', [
            landRecord('1,1', 'bafy-l'),
            worldRecord('w.dcl.eth', '0,0', 'bafy-w'),
          ]),
        ]),
      ).toEqual(new Set(['/multi']));
    });
  });
});
