import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Scene } from '@dcl/schemas';
import type { Stats } from 'fs';

import { PACKAGES_LIST } from '../../../shared/types/pkg';

import { initializeWorkspace } from '../../src/modules/workspace';
import {
  getScene,
  getRowsAndCols,
  parseCoords,
  updateSceneThumbnail,
} from '../../src/modules/scene';
import { getDefaultScenesPath, getScenesPath } from '../../src/modules/settings';
import { getProjectId } from '../../src/modules/analytics';
import {
  NEW_SCENE_NAME,
  EMPTY_SCENE_TEMPLATE_REPO,
  DEFAULT_THUMBNAIL,
} from '../../src/modules/constants';

import { getMockServices } from './services';

vi.mock('../../src/modules/scene');
vi.mock('../../src/modules/settings');
vi.mock('../../src/modules/analytics');

describe('initializeWorkspace', () => {
  let services = getMockServices();
  let workspace = initializeWorkspace(services);

  const mockAppHome = '/user/home/scenes';
  const mockScene = {
    display: {
      title: '',
    },
    worldConfiguration: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();

    services = getMockServices();
    workspace = initializeWorkspace(services);

    vi.mocked(getScenesPath).mockResolvedValue(mockAppHome);
    vi.mocked(getScene).mockResolvedValue({ ...mockScene } as Scene);
  });

  describe('getPath', () => {
    it('should return the app home path if it exists', async () => {
      services.fs.stat.mockResolvedValue({} as any);

      const result = await workspace.getPath();

      expect(getScenesPath).toHaveBeenCalled();
      expect(services.fs.stat).toHaveBeenCalledWith(mockAppHome);
      expect(services.fs.mkdir).not.toHaveBeenCalled();
      expect(result).toBe(mockAppHome);
    });

    it('should create the app home directory if it does not exist', async () => {
      services.fs.stat.mockRejectedValue(new Error('Directory not found'));

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
      const setConfigSpy = vi.spyOn(services.config, 'setConfig');
      const mockConfig = { workspace: { paths: [] } };

      const result = await workspace.createProject();

      const callback = setConfigSpy.mock.calls[0][0];
      callback(mockConfig);

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
      expect(mockConfig.workspace.paths).toContain(`${mockAppHome}/${NEW_SCENE_NAME}`);
      expect(result).toEqual({
        path: `${mockAppHome}/${NEW_SCENE_NAME}`,
      });
    });

    it('should create a project with custom name and path', async () => {
      const customName = 'My Custom Project';
      const customPath = '/custom/path';

      const result = await workspace.createProject({
        name: customName,
        path: customPath,
      });

      expect(services.fs.mkdir).toHaveBeenCalledWith(customPath, { recursive: true });
      expect(services.ipc.invoke).toHaveBeenCalledWith(
        'cli.init',
        customPath,
        EMPTY_SCENE_TEMPLATE_REPO,
      );
      expect(getScene).toHaveBeenCalledWith(customPath);
      expect(services.fs.writeFile).toHaveBeenCalledWith(
        `${customPath}/scene.json`,
        JSON.stringify({ display: { title: customName }, worldConfiguration: {} }, null, 2),
      );
      expect(result).toEqual({
        path: customPath,
      });
    });

    it('should create a project with a custom template repo', async () => {
      const customRepo = 'https://github.com/user/custom-template';
      services.fs.exists.mockResolvedValue(false);
      const scene = { ...mockScene, worldConfiguration: {} } as Scene;
      vi.mocked(getScene).mockResolvedValue(scene);

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

      await expect(workspace.createProject()).rejects.toThrow(
        `Failed to create project "${NEW_SCENE_NAME}": ${errorMessage}`,
      );
    });
  });

  describe('isDCL', () => {
    const mockPath = '/some/path/to/scene';

    it('should return true if the scene exists and has @dcl/sdk dependency', async () => {
      services.pkg.hasDependency.mockResolvedValue(true);

      const result = await workspace.isDCL(mockPath);

      expect(getScene).toHaveBeenCalledWith(mockPath);
      expect(services.pkg.hasDependency).toHaveBeenCalledWith(mockPath, '@dcl/sdk');
      expect(result).toBe(true);
    });

    it('should return false if the scene exists but does not have @dcl/sdk dependency', async () => {
      services.pkg.hasDependency.mockResolvedValue(false);

      const result = await workspace.isDCL(mockPath);

      expect(getScene).toHaveBeenCalledWith(mockPath);
      expect(services.pkg.hasDependency).toHaveBeenCalledWith(mockPath, '@dcl/sdk');
      expect(result).toBe(false);
    });

    it('should return false if getScene throws an error', async () => {
      vi.mocked(getScene).mockRejectedValue(new Error('Scene not found'));

      const result = await workspace.isDCL(mockPath);

      expect(getScene).toHaveBeenCalledWith(mockPath);
      expect(services.pkg.hasDependency).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('isEmpty', () => {
    const mockPath = '/some/path/to/check';

    it('should return true if the directory exists and has no files', async () => {
      services.fs.readdir.mockResolvedValue([]);

      const result = await workspace.isEmpty(mockPath);

      expect(services.fs.readdir).toHaveBeenCalledWith(mockPath);
      expect(result).toBe(true);
    });

    it('should return false if the directory exists and has files', async () => {
      services.fs.readdir.mockResolvedValue(['file1.txt', 'file2.txt']);

      const result = await workspace.isEmpty(mockPath);

      expect(services.fs.readdir).toHaveBeenCalledWith(mockPath);
      expect(result).toBe(false);
    });

    it('should return false if readdir throws an error', async () => {
      services.fs.readdir.mockRejectedValue(new Error('Directory not found'));

      const result = await workspace.isEmpty(mockPath);

      expect(services.fs.readdir).toHaveBeenCalledWith(mockPath);
      expect(result).toBe(false);
    });
  });

  describe('hasNodeModules', () => {
    const mockPath = '/some/path/to/project';

    it('should return true if node_modules folder exists', async () => {
      services.fs.exists.mockResolvedValue(true);

      const result = await workspace.hasNodeModules(mockPath);

      expect(services.path.join).toHaveBeenCalledWith(mockPath, 'node_modules');
      expect(services.fs.exists).toHaveBeenCalledWith(`${mockPath}/node_modules`);
      expect(result).toBe(true);
    });

    it('should return false if node_modules folder does not exist', async () => {
      services.fs.exists.mockResolvedValue(false);

      const result = await workspace.hasNodeModules(mockPath);

      expect(services.path.join).toHaveBeenCalledWith(mockPath, 'node_modules');
      expect(services.fs.exists).toHaveBeenCalledWith(`${mockPath}/node_modules`);
      expect(result).toBe(false);
    });
  });

  describe('getOldProjectThumbnailPath', () => {
    const mockPath = '/some/path/to/project';
    const mockConfigPath = '/some/path/to/project/.dclproject';

    it('should return the old project thumbnail path based on config path', async () => {
      services.config.getWorkspaceConfigPath.mockResolvedValue(mockConfigPath);

      const result = await workspace.getOldProjectThumbnailPath(mockPath);

      expect(services.config.getWorkspaceConfigPath).toHaveBeenCalledWith(mockPath);
      expect(services.path.join).toHaveBeenCalledWith(
        mockConfigPath,
        'images',
        'project-thumbnail.png',
      );
      expect(result).toBe(`${mockConfigPath}/images/project-thumbnail.png`);
    });
  });

  describe('getAvailableThumbnailPath', () => {
    it('should return the autogenerated thumbnail path', () => {
      const result = workspace.getProjectThumbnailPath();

      expect(result).toBe('assets/images/autogenerated-thumbnail.png');
    });
  });

  describe('getProjectThumbnailAsBase64', () => {
    const mockPath = '/some/path/to/project';
    const mockScene = { display: { navmapThumbnail: 'thumbnail.png' } } as any;
    const mockBase64Data = 'mockBase64Data';
    const oldThumbnailPath = '/some/path/to/project/.dclproject/images/project-thumbnail.png';
    const autogeneratedThumbnailPath =
      '/some/path/to/project/assets/images/autogenerated-thumbnail.png';

    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('should return base64 thumbnail if scene has a thumbnail defined', async () => {
      vi.mocked(getScene).mockResolvedValue(mockScene);
      services.path.join.mockImplementation((...args) => args.join('/'));
      services.fs.readFile.mockResolvedValue(Buffer.from(mockBase64Data));

      const result = await workspace.getProjectThumbnailAsBase64(mockPath);

      expect(getScene).toHaveBeenCalledWith(mockPath);
      expect(services.path.join).toHaveBeenCalledWith(mockPath, 'thumbnail.png');
      expect(services.fs.readFile).toHaveBeenCalledWith(`${mockPath}/thumbnail.png`);
      expect(result).toBe(Buffer.from(mockBase64Data).toString('base64'));
    });

    it('should fallback to autogenerated thumbnail if scene thumbnail is missing', async () => {
      vi.mocked(getScene).mockResolvedValue({ display: {} } as Scene);
      services.path.join.mockImplementation((...args) => args.join('/'));
      services.fs.readFile
        .mockRejectedValueOnce(new Error('missing navmapThumbnail'))
        .mockResolvedValueOnce(Buffer.from(mockBase64Data));

      const result = await workspace.getProjectThumbnailAsBase64(mockPath);

      expect(services.path.join).toHaveBeenCalledWith(
        mockPath,
        'assets/images/autogenerated-thumbnail.png',
      );
      expect(services.fs.readFile).toHaveBeenCalledWith(autogeneratedThumbnailPath);
      expect(result).toBe(Buffer.from(mockBase64Data).toString('base64'));
    });

    it('should fallback to old editor thumbnail if autogenerated thumbnail is missing', async () => {
      vi.mocked(getScene).mockRejectedValue(new Error('scene.json missing'));
      services.path.join.mockImplementation((...args) => args.join('/'));
      services.fs.readFile
        .mockRejectedValueOnce(new Error('autogenerated thumbnail missing'))
        .mockResolvedValueOnce(Buffer.from(mockBase64Data));

      services.config.getWorkspaceConfigPath.mockResolvedValue(`${mockPath}/.dclproject`);

      const result = await workspace.getProjectThumbnailAsBase64(mockPath);

      expect(services.fs.readFile).toHaveBeenCalledWith(oldThumbnailPath);
      expect(result).toBe(Buffer.from(mockBase64Data).toString('base64'));
    });

    it('should return DEFAULT_THUMBNAIL if no thumbnails are found', async () => {
      vi.mocked(getScene).mockRejectedValue(new Error('scene.json missing'));
      services.path.join.mockImplementation((...args) => args.join('/'));
      services.fs.readFile.mockRejectedValue(new Error('file not found'));
      services.config.getWorkspaceConfigPath.mockRejectedValue(new Error('config not found'));

      const result = await workspace.getProjectThumbnailAsBase64(mockPath);

      expect(result).toBe(DEFAULT_THUMBNAIL);
    });
  });

  describe('getOutdatedPackages', () => {
    const mockPath = '/path/to/project';
    const mockOutdated = { 'some-package': { current: '1.0.0', latest: '1.2.0' } };

    it('should return outdated dependencies', async () => {
      services.npm.getOutdatedDeps.mockResolvedValue(mockOutdated);

      const result = await workspace.getOutdatedPackages(mockPath);

      expect(services.npm.getOutdatedDeps).toHaveBeenCalledWith(mockPath, PACKAGES_LIST);
      expect(result).toEqual(mockOutdated);
    });
  });

  describe('getProject', () => {
    const mockPath = '/path/to/project';
    const mockScene = {
      scene: { parcels: ['0,0'], base: '0,0' },
      display: { title: 'Test', description: 'Desc' },
    };
    const mockStat = {
      birthtime: new Date(1),
      mtime: new Date(2),
      size: 1234,
    } as Stats;
    const mockDependencyUpdates = { 'some-package': { current: '1.0.0', latest: '1.2.0' } };
    const mockInfo = { key: 'value' };
    const mockThumbnail = Buffer.from('data:image/png;base64,somebase64');

    it('should return a project object', async () => {
      vi.mocked(getProjectId).mockResolvedValue('mock-id');
      vi.mocked(getScene).mockResolvedValue(mockScene as Scene);
      vi.mocked(getRowsAndCols).mockReturnValue({ rows: 1, cols: 1 });
      vi.mocked(parseCoords).mockImplementation(() => ({ x: 0, y: 0 }));
      services.fs.stat.mockResolvedValue(mockStat);
      services.npm.getOutdatedDeps.mockResolvedValue(mockDependencyUpdates);
      services.config.getWorkspaceConfigPath.mockResolvedValue('/config/path');
      services.fs.readFile.mockResolvedValue(mockThumbnail);
      services.project.getProjectInfoFs.mockResolvedValue({
        getAll: vi.fn().mockResolvedValue(mockInfo),
      } as any);

      const result = await workspace.getProject({ path: mockPath });

      expect(result).toEqual(
        expect.objectContaining({
          id: 'mock-id',
          path: mockPath,
          title: 'Test',
          description: 'Desc',
          thumbnail: mockThumbnail.toString('base64'),
          layout: { rows: 1, cols: 1 },
          scene: mockScene.scene,
          createdAt: 1,
          updatedAt: 2,
          publishedAt: 0,
          size: 1234,
          worldConfiguration: undefined,
          dependencyAvailableUpdates: mockDependencyUpdates,
          info: mockInfo,
        }),
      );
    });

    it('should throw an error if something fails', async () => {
      vi.mocked(getProjectId).mockRejectedValue(new Error('fail'));

      await expect(workspace.getProject({ path: mockPath })).rejects.toThrow(
        `Could not get project in "${mockPath}": fail`,
      );
    });
  });

  describe('getProjects', () => {
    const mockPath = '/path/to/project';
    const mockProject = { id: 'mock-id' };

    it('should return an array of projects and empty missing list', async () => {
      services.fs.exists.mockResolvedValue(true);

      const isDCLSpy = vi.spyOn(workspace, 'isDCL').mockResolvedValue(true);
      const getProjectSpy = vi.spyOn(workspace, 'getProject').mockResolvedValue(mockProject);

      const [projects, missing] = await workspace.getProjects(mockPath);

      expect(services.fs.exists).toHaveBeenCalledWith(mockPath);
      expect(isDCLSpy).toHaveBeenCalledWith(mockPath);
      expect(getProjectSpy).toHaveBeenCalledWith({ path: mockPath, opts: undefined });
      expect(projects).toEqual([mockProject]);
      expect(missing).toEqual([]);
    });

    it('should add missing paths if they do not exist', async () => {
      services.fs.exists.mockResolvedValue(false);

      const [projects, missing] = await workspace.getProjects(mockPath);

      expect(projects).toEqual([]);
      expect(missing).toEqual([mockPath]);
    });

    it('should scan directories and find nested projects', async () => {
      services.fs.exists.mockResolvedValue(true);
      services.fs.readdir.mockResolvedValue(['project1', 'project2']);

      // Mock the workspace methods with different return values
      vi.spyOn(workspace, 'isDCL')
        .mockResolvedValueOnce(false) // root is not a project
        .mockResolvedValueOnce(true) // project1 is a project
        .mockResolvedValueOnce(false); // project2 is not a project
      vi.spyOn(workspace, 'getProject').mockResolvedValue({ id: 'nested-project' });

      const [projects, missing] = await workspace.getProjects(mockPath);

      expect(projects).toEqual([{ id: 'nested-project' }]);
      expect(missing).toEqual([]);
    });

    it('should handle errors and add paths to missing list', async () => {
      services.fs.exists.mockRejectedValue(new Error('Error checking path'));

      const [projects, missing] = await workspace.getProjects(mockPath);

      expect(projects).toEqual([]);
      expect(missing).toEqual([mockPath]);
    });
  });

  describe('getTemplates', () => {
    const mockTemplates = [
      { id: '1', scene_type: ['Scene template'] },
      { id: '2', scene_type: ['Other type'] },
    ];

    it('should fetch and filter scene templates', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockTemplates),
      });

      const templates = await workspace.getTemplates();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://studios.decentraland.org/api/get/resources',
      );
      expect(templates).toEqual([{ id: '1', scene_type: ['Scene template'] }]);
    });

    it('should return empty array if fetch fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('fetch error'));

      const templates = await workspace.getTemplates();

      expect(templates).toEqual([]);
    });
  });

  describe('getWorkspace', () => {
    it('returns projects, templates, and settings', async () => {
      services.config.getConfig.mockResolvedValue({
        workspace: { paths: ['/path1', '/path2'] },
        settings: {},
      });
      vi.spyOn(workspace, 'getProjects').mockResolvedValue([[], []]);
      vi.spyOn(workspace, 'getTemplates').mockResolvedValue([]);
      vi.mocked(getDefaultScenesPath).mockResolvedValue('/default/scenes');

      const result = await workspace.getWorkspace();

      expect(result.projects).toEqual([]);
      expect(result.missing).toEqual([]);
      expect(result.templates).toEqual([]);
      expect(result.settings.scenesPath).toBe('/default/scenes');
    });
  });

  describe('unlistProjects', () => {
    it('removes paths from workspace config', async () => {
      const setConfigMock = vi.fn();
      services.config.setConfig.mockImplementation(setConfigMock);

      await workspace.unlistProjects(['/remove/path']);

      expect(setConfigMock).toHaveBeenCalled();
    });
  });

  describe('deleteProject', () => {
    it('calls unlistProjects', async () => {
      const unlistProjectsMock = vi.spyOn(workspace, 'unlistProjects').mockResolvedValue(undefined);

      await workspace.deleteProject('/some/project');

      expect(unlistProjectsMock).toHaveBeenCalledWith(['/some/project']);
    });
  });

  describe('duplicateProject', () => {
    it('duplicates a project and returns the new one', async () => {
      vi.mocked(getScene).mockResolvedValue({ display: { title: 'My Project' } } as Scene);
      vi.spyOn(workspace, 'getAvailable').mockResolvedValue({
        name: 'My Project Copy',
        path: '/new/path',
      });
      services.fs.cp.mockResolvedValue(undefined);
      services.fs.writeFile.mockResolvedValue(undefined);
      vi.spyOn(workspace, 'getProject').mockResolvedValue({ id: 'new-project-id' });

      const result = await workspace.duplicateProject('/original/path');

      expect(services.fs.cp).toHaveBeenCalledWith('/original/path', '/new/path', {
        recursive: true,
      });
      expect(services.fs.writeFile).toHaveBeenCalled();
      expect(result).toEqual({ id: 'new-project-id' });
    });
  });

  describe('isProjectPathAvailable', () => {
    it('returns true if path is not used', async () => {
      services.config.getConfig.mockResolvedValue({
        workspace: { paths: ['/existing/path'] },
      });
      vi.spyOn(workspace, 'getProjects').mockResolvedValue([[], []]);

      const result = await workspace.isProjectPathAvailable('/unique/path');

      expect(result).toBe(true);
    });

    it('returns false if path already exists', async () => {
      services.config.getConfig.mockResolvedValue({
        workspace: { paths: ['/taken/path'] },
      });
      vi.spyOn(workspace, 'getProjects').mockResolvedValue([[{ path: '/taken/path' }], []]);

      const result = await workspace.isProjectPathAvailable('/taken/path');

      expect(result).toBe(false);
    });
  });

  describe('selectNewProjectPath', () => {
    it('should return a new project path if available', async () => {
      services.config.getConfig.mockResolvedValue({
        workspace: { paths: ['/default/path'] },
        settings: { scenesPath: '/default/path' },
      });
      services.ipc.invoke.mockResolvedValue(['/new/project/path']);
      vi.spyOn(workspace, 'isProjectPathAvailable').mockResolvedValue(true);

      const result = await workspace.selectNewProjectPath();

      expect(services.ipc.invoke).toHaveBeenCalledWith('electron.showOpenDialog', {
        title: 'Import project',
        properties: ['openDirectory', 'createDirectory'],
        defaultPath: '/default/path',
      });
      expect(result).toBe('/new/project/path');
    });

    it('should throw an error if the project path is already in use', async () => {
      services.config.getConfig.mockResolvedValue({ settings: { scenesPath: '/default/path' } });
      services.ipc.invoke.mockResolvedValue(['/project/path/existing']);
      vi.spyOn(workspace, 'isProjectPathAvailable').mockResolvedValue(false);

      await expect(workspace.selectNewProjectPath()).rejects.toThrow(
        '"existing" is already on the projects library',
      );
    });
  });

  describe('importProject', () => {
    it('should import a valid project', async () => {
      vi.spyOn(workspace, 'selectNewProjectPath').mockResolvedValue('/valid/project/path');
      vi.spyOn(workspace, 'isDCL').mockResolvedValue(true);
      vi.spyOn(workspace, 'getProject').mockResolvedValue({ id: 'imported-project' });

      const result = await workspace.importProject();

      expect(workspace.selectNewProjectPath).toHaveBeenCalled();
      expect(workspace.isDCL).toHaveBeenCalledWith('/valid/project/path');
      expect(services.config.setConfig).toHaveBeenCalled();
      expect(result).toEqual({ id: 'imported-project' });
    });

    it('should throw an error if the selected directory is not a valid project', async () => {
      vi.spyOn(workspace, 'selectNewProjectPath').mockResolvedValue('/project/path/invalid');
      vi.spyOn(workspace, 'isDCL').mockResolvedValue(false);

      await expect(workspace.importProject()).rejects.toThrow('"invalid" is not a valid project');
    });

    it('should update workspace config with new project path', async () => {
      const mockPath = '/new/project/path';
      vi.spyOn(workspace, 'selectNewProjectPath').mockResolvedValue(mockPath);
      vi.spyOn(workspace, 'isDCL').mockResolvedValue(true);
      vi.spyOn(workspace, 'getProject').mockResolvedValue({ id: 'imported-project' });

      await workspace.importProject();

      expect(services.config.setConfig).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('reimportProject', () => {
    it('should reimport a project and unlist the old path', async () => {
      vi.spyOn(workspace, 'importProject').mockResolvedValue({ id: 'reimported-project' });
      const unlistProjectsMock = vi.spyOn(workspace, 'unlistProjects').mockResolvedValue();

      const result = await workspace.reimportProject('/old/project/path');

      expect(workspace.importProject).toHaveBeenCalled();
      expect(unlistProjectsMock).toHaveBeenCalledWith(['/old/project/path']);
      expect(result).toEqual({ id: 'reimported-project' });
    });
  });

  describe('saveThumbnail', () => {
    it('should save a base64 thumbnail and update scene metadata', async () => {
      const mockScene = { display: { navmapThumbnail: 'old-thumbnail.png' } } as Scene;
      vi.mocked(getScene).mockResolvedValue(mockScene);
      services.fs.exists.mockResolvedValue(false);

      await workspace.saveThumbnail({
        path: '/project/path',
        thumbnail: 'base64data',
      });

      expect(services.fs.writeFile).toHaveBeenCalledWith(
        '/project/path/assets/images/autogenerated-thumbnail.png',
        'base64data',
        { encoding: 'base64' },
      );
      expect(services.fs.exists).toHaveBeenCalledWith('/project/path/old-thumbnail.png');
      expect(updateSceneThumbnail).toHaveBeenCalled();
    });
  });

  describe('updateProjectInfo', () => {
    it('should update project info', async () => {
      const mockProjectInfoFs = {
        getAll: vi.fn().mockResolvedValue({ key: 'oldValue' }),
        setAll: vi.fn().mockResolvedValue(undefined),
      };
      services.project.getProjectInfoFs.mockResolvedValue(mockProjectInfoFs);

      await workspace.updateProjectInfo({ path: '/project/path', info: { key: 'newValue' } });

      expect(mockProjectInfoFs.getAll).toHaveBeenCalled();
      expect(mockProjectInfoFs.setAll).toHaveBeenCalledWith({ key: 'newValue' });
    });
  });
});
