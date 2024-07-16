import { useDispatch, useSelector } from '#store';
import { useCallback } from 'react';
import { actions } from '/@/modules/store/workspace';
import { type Project, type SortBy } from '/shared/types/projects';

export const useWorkspace = () => {
  const dispatch = useDispatch();
  const workspace = useSelector(state => state.workspace);

  const getWorkspace = useCallback(() => {
    dispatch(actions.getWorkspace());
  }, []);

  const setSortBy = useCallback((type: SortBy) => {
    dispatch(actions.setSortBy(type));
  }, []);

  const createProject = useCallback(() => {
    dispatch(actions.createProject());
  }, []);

  const deleteProject = useCallback((project: Project) => {
    dispatch(actions.deleteProject(project.path));
  }, []);

  const duplicateProject = useCallback((project: Project) => {
    dispatch(actions.duplicateProject(project.path));
  }, []);

  const importProject = useCallback(() => {
    dispatch(actions.importProject());
  }, []);

  return {
    ...workspace,
    getWorkspace,
    setSortBy,
    createProject,
    deleteProject,
    duplicateProject,
    importProject,
  };
};
