import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Scene } from '@dcl/schemas';

import { tryCatch } from '/shared/try-catch';
import { actions as workspaceActions } from '/@/modules/store/workspace';
import { workspace as workspacePreload } from '#preload';
import { useDispatch, useSelector } from '#store';

import type { ProjectInfo, Project, SortBy } from '/shared/types/projects';

export const useWorkspace = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const workspace = useSelector(state => state.workspace);

  const getWorkspace = useCallback(() => {
    dispatch(workspaceActions.getWorkspace());
  }, []);

  const setSortBy = useCallback((type: SortBy) => {
    dispatch(workspaceActions.setSortBy(type));
  }, []);

  const runProject = useCallback((project: Project) => {
    dispatch(workspaceActions.runProject(project));
    navigate('/editor');
  }, []);

  const createProject = useCallback(
    (opts: Parameters<typeof workspaceActions.createProjectAndInstall>[0]) => {
      dispatch(workspaceActions.createProjectAndInstall(opts));
      navigate('/editor');
    },
    [],
  );

  const deleteProject = useCallback((project: Project, shouldDeleteFiles: boolean) => {
    dispatch(workspaceActions.deleteProject({ path: project.path, shouldDeleteFiles }));
  }, []);

  const duplicateProject = useCallback((project: Project) => {
    dispatch(workspaceActions.duplicateProject(project.path));
  }, []);

  const importProject = useCallback(() => {
    dispatch(workspaceActions.importProject());
  }, []);

  const reimportProject = useCallback((path: string) => {
    dispatch(workspaceActions.reimportProject(path));
  }, []);

  const unlistProjects = useCallback((paths: string[]) => {
    dispatch(workspaceActions.unlistProjects(paths));
  }, []);

  const openFolder = useCallback((path: string) => {
    dispatch(workspaceActions.openFolder(path));
  }, []);

  const updatePackages = useCallback((project: Project) => {
    dispatch(workspaceActions.updatePackages(project));
  }, []);

  const updateProject = useCallback((project: Project) => {
    dispatch(workspaceActions.updateProject(project));
  }, []);

  const updateSceneJson = useCallback((path: string, updates: Partial<Scene>) => {
    return dispatch(workspaceActions.updateSceneJson({ path, updates }));
  }, []);

  /**
   * Returns whether or not the provided directory is a valid base path to create new scenes/projects
   */
  const validateScenesPath = useCallback(async (path: string) => {
    const isValid = await workspacePreload.validateScenesPath(path);
    return isValid;
  }, []);

  /**
   * Returns whether or not the provided directory is a valid path to create a new project.
   * It ensures that the path is not used by another project yet.
   */
  const validateProjectPath = useCallback(async (projectPath: string, projectName: string) => {
    const isValidDirectory = await workspacePreload.validateScenesPath(projectPath);
    const isPathAvailable = await workspacePreload.isProjectPathAvailable(
      `${projectPath}/${projectName}`,
    );
    return isPathAvailable && isValidDirectory;
  }, []);

  const selectNewProjectPath = useCallback(async () => {
    const result = await workspacePreload.selectNewProjectPath();
    return result;
  }, []);

  const getAvailableProject = useCallback(async () => {
    const result = await tryCatch(workspacePreload.getAvailable());
    return result;
  }, []);

  const isLoading = workspace.status === 'loading';

  const updateProjectInfo = useCallback((path: string, info: Partial<ProjectInfo>) => {
    dispatch(workspaceActions.updateProjectInfo({ path, info }));
  }, []);

  return {
    ...workspace,
    getWorkspace,
    setSortBy,
    runProject,
    createProject,
    deleteProject,
    duplicateProject,
    importProject,
    reimportProject,
    unlistProjects,
    openFolder,
    updatePackages,
    updateProject,
    updateSceneJson,
    validateScenesPath,
    validateProjectPath,
    selectNewProjectPath,
    getAvailableProject,
    isLoading,
    updateProjectInfo,
  };
};
