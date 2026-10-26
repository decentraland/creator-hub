import type { Scene } from '@dcl/schemas';
import { captureException } from '@sentry/electron/renderer';

import { shouldUpdateDependencies } from './utils';
import { actions } from './index';
import { fs, npm, pkg, scene, settings, skills, workspace } from '#preload';

import { createAsyncThunk } from '/@/modules/store/thunk';

import {
  type DependencyState,
  type Project,
  ProjectError,
  PROJECT_ALREADY_IMPORTED_ERROR_PREFIX,
} from '/shared/types/projects';
import { DEPENDENCY_UPDATE_STRATEGY } from '/shared/types/settings';
import { PACKAGES } from '/shared/types/pkg';
import { WorkspaceError } from '/shared/types/workspace';

export const getWorkspace = createAsyncThunk('workspace/getWorkspace', workspace.getWorkspace);
export const getProject = createAsyncThunk('workspace/getProject', workspace.getProject);
export const createProject = createAsyncThunk(
  'workspace/createProject',
  async (opts: Parameters<typeof workspace.createProject>[0]) => {
    const { path } = await workspace.createProject(opts);
    const project = await workspace.getProject({ path });
    return project;
  },
);
export const deleteProject = createAsyncThunk('workspace/deleteProject', workspace.deleteProject);
export const duplicateProject = createAsyncThunk(
  'workspace/duplicateProject',
  workspace.duplicateProject,
);
export const renameProject = createAsyncThunk('workspace/renameProject', workspace.renameProject);
export const importProject = createAsyncThunk(
  'workspace/importProject',
  async (_, { rejectWithValue }) => {
    try {
      return await workspace.importProject();
    } catch (error: any) {
      if (
        typeof error?.message === 'string' &&
        error.message.startsWith(PROJECT_ALREADY_IMPORTED_ERROR_PREFIX)
      ) {
        return rejectWithValue(new ProjectError('PROJECT_ALREADY_IMPORTED', error.message));
      }
      throw error;
    }
  },
);
export const reimportProject = createAsyncThunk(
  'workspace/reimportProject',
  workspace.reimportProject,
);
export const unlistProjects = createAsyncThunk(
  'workspace/unlistProjects',
  workspace.unlistProjects,
);
export const openFolder = createAsyncThunk('workspace/openFolder', workspace.openFolder);
export const fetchSdkCommandsVersion = createAsyncThunk(
  'workspace/fetchSdkCommandsVersion',
  async (path: string) => (await pkg.getPackageVersion(path, PACKAGES.SDK_PACKAGE)) ?? null,
);

export const installProject = createAsyncThunk(
  'npm/install',
  async ({ path, packages }: { path: string; packages?: string[] }, { dispatch }) => {
    try {
      await npm.install(path, packages);
    } catch (error) {
      captureException(error, {
        tags: { source: 'workspace', event: 'npm-install' },
        extra: { path, packages },
      });
      throw error;
    }
    await npm.getContextFiles(path);
    dispatch(fetchSdkCommandsVersion(path));
  },
);
export const saveThumbnail = createAsyncThunk('workspace/saveThumbnail', workspace.saveThumbnail);
export const saveAndGetThumbnail = createAsyncThunk(
  'workspace/saveAndGetThumbnail',
  async (opts: Parameters<typeof workspace.saveThumbnail>[0], { dispatch }) => {
    await dispatch(saveThumbnail(opts)).unwrap();
    const thumbnail = await workspace.getProjectThumbnailAsBase64(opts.path);
    return thumbnail;
  },
);
export const createProjectAndInstall = createAsyncThunk(
  'workspace/createProjectAndInstall',
  async (opts: Parameters<typeof workspace.createProject>[0], { dispatch }) => {
    const { path } = await dispatch(createProject(opts)).unwrap();
    dispatch(installProject({ path }));
  },
);
export const updatePackages = createAsyncThunk(
  'workspace/updatePackages',
  async (project: Project, { dispatch }) => {
    const latestPackages = Object.entries(project.dependencyAvailableUpdates).map(
      ([pkg, { latest }]) => `${pkg}@${latest}`,
    );
    await dispatch(installProject({ path: project.path, packages: latestPackages })).unwrap();
  },
);
export const updateAvailableDependencyUpdates = createAsyncThunk(
  'workspace/updateAvailableDependencyUpdates',
  (
    { project, updates }: { project: Project; updates: Project['dependencyAvailableUpdates'] },
    { getState },
  ): { project: Project; strategy: DEPENDENCY_UPDATE_STRATEGY } => {
    return {
      project: { ...project, dependencyAvailableUpdates: updates },
      strategy: getState().workspace.settings.dependencyUpdateStrategy,
    };
  },
);
export const updateSdkSkills = createAsyncThunk(
  'workspace/updateSdkSkills',
  async (project: Project) => {
    try {
      await skills.updateProject(project.path);
    } catch (error) {
      captureException(error, {
        tags: { source: 'workspace', event: 'update-sdk-skills' },
        extra: { path: project.path },
      });
      throw error;
    }
  },
);
// Follows the dependency update strategy: the skills are as much a part of keeping a scene
// current as its packages.
export const checkSdkSkillsUpdate = createAsyncThunk(
  'workspace/checkSdkSkillsUpdate',
  async (project: Project, { dispatch, getState }) => {
    const strategy = getState().workspace.settings.dependencyUpdateStrategy;
    if (strategy === DEPENDENCY_UPDATE_STRATEGY.DO_NOTHING) return { project, outdated: false };

    const { outdated } = await skills.getProjectStatus(project.path);
    if (outdated && strategy === DEPENDENCY_UPDATE_STRATEGY.AUTO_UPDATE) {
      await dispatch(updateSdkSkills(project)).unwrap();
      return { project, outdated: false };
    }
    return { project, outdated };
  },
);
export const runProject = createAsyncThunk(
  'workspace/runProject',
  async (project: Project, { dispatch, getState, rejectWithValue }) => {
    const { workspace: _workspace } = getState();
    const strategy = _workspace.settings.dependencyUpdateStrategy;

    if (!(await fs.exists(project.path))) {
      // if project is on the project's list but directory doesn't exist, then it was removed while app was running...
      dispatch(actions.moveProjectToMissing(project));
      return rejectWithValue(new WorkspaceError('PROJECT_NOT_FOUND'));
    }

    // Not awaited: it hits GitHub and must never hold up opening the scene.
    dispatch(checkSdkSkillsUpdate(project));

    // It's possible for "node_modules" to not exist because it was never installed before
    // or because the user deleted it while the app was running.
    // In any case, we have to "npm install" & "npm outdated"
    const hasNodeModules = await workspace.hasNodeModules(project.path);
    let dependencyAvailableUpdates: DependencyState = {};

    try {
      dependencyAvailableUpdates = hasNodeModules
        ? await workspace.getOutdatedPackages(project.path)
        : await (async () => {
            await dispatch(installProject({ path: project.path })).unwrap();
            return workspace.getOutdatedPackages(project.path);
          })();
    } catch (error) {
      console.warn(
        'Failed to check for outdated packages, continuing without update check:',
        error,
      );
      captureException(error, {
        tags: {
          source: 'workspace',
          event: 'check-outdated-packages',
        },
        extra: { path: project.path },
      });
      dependencyAvailableUpdates = {};
    }

    if (shouldUpdateDependencies(strategy, dependencyAvailableUpdates)) {
      await dispatch(updatePackages({ ...project, dependencyAvailableUpdates })).unwrap();
      return { ...project, dependencyAvailableUpdates: {} };
    }

    const { project: updatedProject } = await dispatch(
      updateAvailableDependencyUpdates({ project, updates: dependencyAvailableUpdates }),
    ).unwrap();

    // Only fetch SDK version when installProject was not called
    if (hasNodeModules) {
      dispatch(fetchSdkCommandsVersion(project.path));
    }
    return updatedProject;
  },
);
export const updateSettings = createAsyncThunk('config/updateSettings', settings.updateAppSettings);
export const updateSceneJson = createAsyncThunk(
  'scene/updateScene',
  async ({ path, updates }: { path: string; updates: Partial<Scene> }) => {
    const _scene = await scene.getScene(path);
    await scene.writeScene({ path, scene: { ..._scene, ...updates } });
  },
);

export const updateProjectInfo = createAsyncThunk(
  'workspace/updateProjectInfo',
  workspace.updateProjectInfo,
);

export const getAvailable = createAsyncThunk(
  'workspace/getAvailable',
  async (name: string, { rejectWithValue }) => {
    try {
      const result = await workspace.getAvailable(name);
      return result;
    } catch (error: any) {
      return rejectWithValue(new ProjectError('INVALID_PATH', error.message));
    }
  },
);
