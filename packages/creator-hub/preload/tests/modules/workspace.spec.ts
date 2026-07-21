import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Scene } from '@dcl/schemas';

import { initializeWorkspace } from '../../src/modules/workspace';
import { getScenesPath } from '../../src/modules/settings';
import { getScene } from '../../src/modules/scene';
import { getProjectId } from '../../src/modules/analytics';
import { NEW_SCENE_NAME, EMPTY_SCENE_TEMPLATE_REPO } from '../../src/modules/constants';

import { getMockServices } from './services';

vi.mock('../../src/modules/scene');
vi.mock('../../src/modules/settings');
// `getProjectId` goes through the real `services/ipc.ts` (backed by electron's `ipcRenderer`)
// instead of the injected `ipc` service, so it can't be exercised in this Node test environment.
vi.mock('../../src/modules/analytics');
// `getProject` (used by `renameProject`) reads/writes a per-project metadata file via
// `FileSystemStorage`, which uses `node:fs/promises` directly instead of the mocked `fs` service.
// Auto-mock it so those tests never touch the real filesystem.
vi.mock('node:fs/promises');

describe('initializeWorkspace', () => {
  const services = getMockServices();

  const mockAppHome = '/user/home/scenes';
  const mockScene = {
    display: {
      title: '',
    },
    worldConfiguration: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getScenesPath).mockResolvedValue(mockAppHome);
    vi.mocked(getScene).mockResolvedValue({ ...mockScene } as Scene);
    vi.mocked(getProjectId).mockResolvedValue('mock-id');
  });

  describe('getPath', () => {
    it('should return the app home path if it exists', async () => {
      services.fs.stat.mockResolvedValue({} as any);

      const workspace = initializeWorkspace(services);
      const result = await workspace.getPath();

      expect(getScenesPath).toHaveBeenCalled();
      expect(services.fs.stat).toHaveBeenCalledWith(mockAppHome);
      expect(services.fs.mkdir).not.toHaveBeenCalled();
      expect(result).toBe(mockAppHome);
    });

    it('should create the app home directory if it does not exist', async () => {
      services.fs.stat.mockRejectedValue(new Error('Directory not found'));

      const workspace = initializeWorkspace(services);
      const result = await workspace.getPath();

      expect(getScenesPath).toHaveBeenCalled();
      expect(services.fs.stat).toHaveBeenCalledWith(mockAppHome);
      expect(services.fs.mkdir).toHaveBeenCalledWith(mockAppHome);
      expect(result).toBe(mockAppHome);
    });
  });

  describe('getAvailable', () => {
    it('should return the default name and path if available', async () => {
      services.fs.exists.mockResolvedValue(false);

      const workspace = initializeWorkspace(services);
      const result = await workspace.getAvailable();

      expect(services.path.join).toHaveBeenCalledWith(mockAppHome, NEW_SCENE_NAME);
      expect(services.fs.exists).toHaveBeenCalledWith(`${mockAppHome}/${NEW_SCENE_NAME}`);
      expect(result).toEqual({
        name: NEW_SCENE_NAME,
        path: `${mockAppHome}/${NEW_SCENE_NAME}`,
      });
    });

    it('should increment the name counter if the default name is taken', async () => {
      services.fs.exists.mockImplementation(async path => {
        return (
          path === `${mockAppHome}/${NEW_SCENE_NAME}` ||
          path === `${mockAppHome}/${NEW_SCENE_NAME} 2`
        );
      });

      const workspace = initializeWorkspace(services);
      const result = await workspace.getAvailable();

      expect(services.fs.exists).toHaveBeenCalledTimes(3);
      expect(result).toEqual({
        name: `${NEW_SCENE_NAME} 3`,
        path: `${mockAppHome}/${NEW_SCENE_NAME} 3`,
      });
    });

    it('should use the provided name if given', async () => {
      const customName = 'My Custom Scene';
      services.fs.exists.mockResolvedValue(false);

      const workspace = initializeWorkspace(services);
      const result = await workspace.getAvailable(customName);

      expect(services.path.join).toHaveBeenCalledWith(mockAppHome, customName);
      expect(result).toEqual({
        name: customName,
        path: `${mockAppHome}/${customName}`,
      });
    });
  });

  describe('createProject', () => {
    it('should create a project with default settings', async () => {
      services.fs.exists.mockResolvedValue(false);

      const workspace = initializeWorkspace(services);
      const result = await workspace.createProject();

      expect(services.fs.mkdir).toHaveBeenCalledWith(`${mockAppHome}/${NEW_SCENE_NAME}`, {
        recursive: true,
      });
      expect(services.ipc.invoke).toHaveBeenCalledWith(
        'cli.init',
        `${mockAppHome}/${NEW_SCENE_NAME}`,
        EMPTY_SCENE_TEMPLATE_REPO,
      );
      expect(getScene).toHaveBeenCalledWith(`${mockAppHome}/${NEW_SCENE_NAME}`);
      expect(services.fs.writeFile).toHaveBeenCalledWith(
        `${mockAppHome}/${NEW_SCENE_NAME}/scene.json`,
        JSON.stringify({ display: { title: NEW_SCENE_NAME }, worldConfiguration: {} }, null, 2),
      );
      expect(services.config.setConfig).toHaveBeenCalled();
      expect(result).toEqual({
        path: `${mockAppHome}/${NEW_SCENE_NAME}`,
      });
    });

    it('should create a project with custom name and path', async () => {
      const customName = 'My Custom Project';
      const customPath = '/custom/path';
      const fullName = services.path.join(customPath, customName);

      const workspace = initializeWorkspace(services);
      const result = await workspace.createProject({
        name: customName,
        path: customPath,
      });

      expect(services.fs.mkdir).toHaveBeenCalledWith(fullName, {
        recursive: true,
      });
      expect(services.ipc.invoke).toHaveBeenCalledWith(
        'cli.init',
        fullName,
        EMPTY_SCENE_TEMPLATE_REPO,
      );
      expect(getScene).toHaveBeenCalledWith(fullName);
      expect(services.fs.writeFile).toHaveBeenCalledWith(
        services.path.join(fullName, 'scene.json'),
        JSON.stringify({ display: { title: customName }, worldConfiguration: {} }, null, 2),
      );
      expect(result).toEqual({
        path: fullName,
      });
    });

    it('should create a project with a custom template repo', async () => {
      const customRepo = 'https://github.com/user/custom-template';
      services.fs.exists.mockResolvedValue(false);
      const scene = { ...mockScene, worldConfiguration: {} } as Scene;
      vi.mocked(getScene).mockResolvedValue(scene);

      const workspace = initializeWorkspace(services);
      const _ = await workspace.createProject({
        repo: customRepo,
      });

      expect(services.ipc.invoke).toHaveBeenCalledWith(
        'cli.init',
        `${mockAppHome}/${NEW_SCENE_NAME}`,
        customRepo,
      );
      expect(services.fs.writeFile).toHaveBeenCalledWith(
        `${mockAppHome}/${NEW_SCENE_NAME}/scene.json`,
        JSON.stringify({ display: { title: NEW_SCENE_NAME } }, null, 2),
      );
      expect(scene.worldConfiguration).toBeUndefined();
    });

    it('should throw an error when project creation fails', async () => {
      const errorMessage = 'Failed to initialize project';
      services.ipc.invoke.mockRejectedValue(new Error(errorMessage));

      const workspace = initializeWorkspace(services);
      await expect(workspace.createProject()).rejects.toThrow(
        `Failed to create project "${NEW_SCENE_NAME}": ${errorMessage}`,
      );
    });
  });

  describe('renameProject', () => {
    const currentPath = `${mockAppHome}/My Scene`;

    beforeEach(() => {
      services.fs.stat.mockResolvedValue({
        birthtime: new Date(0),
        mtime: new Date(0),
        size: 0,
      } as any);
      services.ipc.invoke.mockResolvedValue(undefined);
      vi.mocked(getScene).mockResolvedValue({
        ...mockScene,
        scene: { parcels: [] },
      } as unknown as Scene);
    });

    it('should reject an invalid folder name without touching the filesystem', async () => {
      const workspace = initializeWorkspace(services);

      await expect(
        workspace.renameProject({ path: currentPath, newName: 'in/valid' }),
      ).rejects.toThrow(/Invalid folder name/);
      expect(services.fs.rename).not.toHaveBeenCalled();
      expect(services.config.setConfig).not.toHaveBeenCalled();
    });

    it('should reject a name that collides with an existing folder', async () => {
      services.fs.exists.mockResolvedValue(true);

      const workspace = initializeWorkspace(services);

      await expect(
        workspace.renameProject({ path: currentPath, newName: 'New Name' }),
      ).rejects.toThrow(/already exists/);
      expect(services.fs.rename).not.toHaveBeenCalled();
      expect(services.config.setConfig).not.toHaveBeenCalled();
    });

    it('should do nothing and return the current project if the name is unchanged', async () => {
      services.fs.exists.mockResolvedValue(false);

      const workspace = initializeWorkspace(services);
      const result = await workspace.renameProject({ path: currentPath, newName: 'My Scene' });

      expect(services.fs.rename).not.toHaveBeenCalled();
      expect(services.config.setConfig).not.toHaveBeenCalled();
      expect(result.path).toBe(currentPath);
    });

    it('should rename the folder and update the workspace config with the new path', async () => {
      services.fs.exists.mockResolvedValue(false);
      const newPath = `${mockAppHome}/New Name`;

      const workspace = initializeWorkspace(services);
      const result = await workspace.renameProject({ path: currentPath, newName: 'New Name' });

      expect(services.fs.rename).toHaveBeenCalledWith(currentPath, newPath);
      expect(services.config.setConfig).toHaveBeenCalled();

      const drafter = services.config.setConfig.mock.calls[0][0];
      const draftConfig = { workspace: { paths: [currentPath, '/other/project'] } };
      drafter(draftConfig);
      expect(draftConfig.workspace.paths).toEqual([newPath, '/other/project']);

      expect(result.path).toBe(newPath);
    });
  });

  describe('when getting the scene source file', () => {
    describe('and the file exists', () => {
      let projectPath: string;
      let fileContent: string;

      beforeEach(() => {
        projectPath = '/path/to/project';
        fileContent = 'export function main() {}';
        services.fs.readFile.mockResolvedValue(Buffer.from(fileContent));
      });

      it('should read the default scene file', async () => {
        const workspace = initializeWorkspace(services);
        const result = await workspace.getSceneSourceFile(projectPath);

        expect(services.path.join).toHaveBeenCalledWith(projectPath, 'src/index.ts');
        expect(services.fs.readFile).toHaveBeenCalled();
        expect(result).toBe(fileContent);
      });
    });

    describe('and a custom file path is provided', () => {
      let projectPath: string;
      let customFilePath: string;
      let fileContent: string;

      beforeEach(() => {
        projectPath = '/path/to/project';
        customFilePath = 'src/custom.ts';
        fileContent = 'export function custom() {}';
        services.fs.readFile.mockResolvedValue(Buffer.from(fileContent));
      });

      it('should read the specified file', async () => {
        const workspace = initializeWorkspace(services);
        const result = await workspace.getSceneSourceFile(projectPath, customFilePath);

        expect(services.path.join).toHaveBeenCalledWith(projectPath, customFilePath);
        expect(result).toBe(fileContent);
      });
    });

    describe('and the file does not exist', () => {
      let projectPath: string;

      beforeEach(() => {
        projectPath = '/path/to/project';
        services.fs.readFile.mockRejectedValue(new Error('File not found'));
      });

      it('should throw an error with descriptive message', async () => {
        const workspace = initializeWorkspace(services);

        await expect(workspace.getSceneSourceFile(projectPath)).rejects.toThrow(
          'Could not read scene source file',
        );
      });
    });
  });
});
