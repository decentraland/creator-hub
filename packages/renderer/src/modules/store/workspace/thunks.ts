import { fs, npm, workspace } from '#preload';

import { createAsyncThunk } from '/@/modules/store/thunk';

import { type PACKAGES, PACKAGES_LIST } from '/shared/types/pkg';
import { type Project } from '/shared/types/projects';
import { type Settings } from '/shared/types/settings';
import { WorkspaceError } from '/shared/types/workspace';

import { installAndGetOutdatedPackages, shouldUpdateDependencies } from './utils';

export const getWorkspace = createAsyncThunk('workspace/getWorkspace', workspace.getWorkspace);
export const createProject = createAsyncThunk('workspace/createProject', workspace.createProject);
export const updateProject = createAsyncThunk('workspace/updateProject', workspace.updateProject);
export const deleteProject = createAsyncThunk('workspace/deleteProject', workspace.deleteProject);
export const duplicateProject = createAsyncThunk(
  'workspace/duplicateProject',
  workspace.duplicateProject,
);
export const importProject = createAsyncThunk('workspace/importProject', workspace.importProject);
export const reimportProject = createAsyncThunk(
  'workspace/reimportProject',
  workspace.reimportProject,
);
export const unlistProjects = createAsyncThunk(
  'workspace/unlistProjects',
  workspace.unlistProjects,
);
export const openFolder = createAsyncThunk('workspace/openFolder', workspace.openFolder);
export const installProject = createAsyncThunk('npm/install', async (path: string) =>
  npm.install(path),
);
export const saveThumbnail = createAsyncThunk(
  'workspace/saveThumbnail',
  async ({ path, thumbnail }: Parameters<typeof workspace.saveThumbnail>[0]) => {
    await workspace.saveThumbnail({ path, thumbnail });
    const project = await workspace.getProject(path); // TODO: remove this and create a getThumbnail method...
    return project;
  },
);
export const createProjectAndInstall = createAsyncThunk(
  'workspace/createProjectAndInstall',
  async (opts: Parameters<typeof workspace.createProject>[0], { dispatch }) => {
    const { path } = await dispatch(createProject(opts)).unwrap();
    dispatch(installProject(path));
  },
);
export const updatePackages = createAsyncThunk(
  'workspace/updatePackages',
  async ({ project, packages = PACKAGES_LIST }: { project: Project; packages?: PACKAGES[] }) => {
    const latestPackages = packages.map($ => `${$}@latest`); // TODO: should not be latest!
    await npm.install(project.path, latestPackages);
  },
);
export const runProject = createAsyncThunk(
  'workspace/runProject',
  async (
    project: Project,
    { dispatch, getState },
  ): Promise<{ project: Project; settings: Settings }> => {
    const { workspace: _workspace } = getState();
    const strategy = _workspace.settings.dependencyUpdateStrategy;

    if (!(await fs.exists(project.path))) {
      // if project is on the project's list but directory doesn't exist, then it was removed while app was running...
      throw new WorkspaceError('PROJECT_NOT_FOUND');
    }

    // It's possible for "node_modules" to not exist because it was never installed before
    // or because the user deleted it while the app was running.
    // In any case, we have to "npm install" & "npm outdated"
    const hasNodeModules = await workspace.hasNodeModules(project.path);
    const dependencyAvailableUpdates = hasNodeModules
      ? await workspace.getOutdatedPackages(project.path)
      : await installAndGetOutdatedPackages(project.path);

    if (shouldUpdateDependencies(strategy, dependencyAvailableUpdates)) {
      dispatch(updatePackages({ project }));
      return {
        project: { ...project, dependencyAvailableUpdates: {} },
        settings: _workspace.settings,
      };
    }

    return { project, settings: _workspace.settings };
  },
);
