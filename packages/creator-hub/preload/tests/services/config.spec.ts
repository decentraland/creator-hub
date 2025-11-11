import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { produce, type WritableDraft } from 'immer';
import type { Config } from '../../../shared/types/config';

import * as ipc from '../../src/services/ipc';
import { getConfig, setConfig, getWorkspaceConfigPath } from '../../src/services/config';

vi.mock('../../src/services/ipc');

describe('config service', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getConfig', () => {
    let mockConfig: Config;

    beforeEach(() => {
      mockConfig = {
        workspace: { paths: ['/path1', '/path2'] },
        settings: { scenesPath: '/default/scenes' },
      } as Config;

      vi.mocked(ipc.invoke).mockResolvedValue(mockConfig);
    });

    it('should call ipc.invoke with correct channel', async () => {
      await getConfig();

      expect(ipc.invoke).toHaveBeenCalledWith('config.getConfig');
    });

    it('should return the config from ipc', async () => {
      const result = await getConfig();

      expect(result).toEqual(mockConfig);
    });
  });

  describe('setConfig', () => {
    let mockConfig: Config;

    beforeEach(() => {
      mockConfig = {
        workspace: { paths: ['/path1'] },
        settings: { scenesPath: '/scenes' },
      } as Config;

      vi.mocked(ipc.invoke).mockResolvedValue(mockConfig);
    });

    it('should retrieve current config', async () => {
      const drafter = vi.fn();

      await setConfig(drafter);

      expect(ipc.invoke).toHaveBeenCalledWith('config.getConfig');
    });

    it('should call drafter with config draft', async () => {
      const drafter = vi.fn();

      await setConfig(drafter);

      expect(drafter).toHaveBeenCalled();
    });

    it('should write updated config via ipc', async () => {
      const drafter = (draft: WritableDraft<Config>) => {
        draft.workspace.paths.push('/new/path');
      };

      await setConfig(drafter);

      const expectedConfig = produce(mockConfig, drafter);
      expect(ipc.invoke).toHaveBeenCalledWith('config.writeConfig', expectedConfig);
    });

    it('should preserve immutability with immer', async () => {
      const originalPaths = [...mockConfig.workspace.paths];
      const drafter = (draft: WritableDraft<Config>) => {
        draft.workspace.paths.push('/new/path');
      };

      await setConfig(drafter);

      expect(mockConfig.workspace.paths).toEqual(originalPaths);
    });
  });

  describe('getWorkspaceConfigPath', () => {
    const mockPath = '/some/workspace/path';
    const mockConfigPath = '/some/workspace/path/.dclproject';

    beforeEach(() => {
      vi.mocked(ipc.invoke).mockResolvedValue(mockConfigPath);
    });

    it('should call ipc.invoke with correct channel and path', async () => {
      await getWorkspaceConfigPath(mockPath);

      expect(ipc.invoke).toHaveBeenCalledWith('electron.getWorkspaceConfigPath', mockPath);
    });

    it('should return the config path from ipc', async () => {
      const result = await getWorkspaceConfigPath(mockPath);

      expect(result).toBe(mockConfigPath);
    });
  });
});
