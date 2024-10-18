import { useCallback } from 'react';

import { editor as editorApi } from '#preload';
import { useDispatch, useSelector } from '#store';

import type { Project } from '/shared/types/projects';
import type { DeployOptions } from '/shared/types/ipc';

import { actions as editorActions } from '/@/modules/store/editor';
import { actions as workspaceActions } from '/@/modules/store/workspace';
import type { Method, Params } from '/@/modules/rpc/storage';
import { useScene } from './useScene';
import type { CallbackParams } from '../modules/rpc';

export const useEditor = () => {
  const dispatch = useDispatch();
  const { updateThumbnail } = useScene();
  const editor = useSelector(state => state.editor);
  const { project } = editor;

  const startInspector = useCallback(() => {
    dispatch(editorActions.startInspector());
  }, [dispatch, editorActions.startInspector]);

  const runScene = useCallback(
    (project: Project) => {
      dispatch(editorActions.runScene(project.path));
    },
    [project],
  );

  const publishScene = useCallback(
    (opts: Omit<DeployOptions, 'path'> = {}) => {
      if (project) {
        dispatch(editorActions.publishScene({ ...opts, path: project.path }));
      }
    },
    [project, editorActions.publishScene],
  );

  const openPreview = useCallback(() => {
    if (project) {
      dispatch(editorActions.runScene(project.path));
    }
  }, [project, editorActions.runScene]);

  const openCode = useCallback(() => {
    if (project) {
      editorApi.openCode(project.path);
    }
  }, [editorApi.openCode, project]);

  const updateScene = useCallback(
    async (cbParams: CallbackParams, { path }: Params[Method.WRITE_FILE]) => {
      if (!project) return;

      // TODO: we could alternatively have an "updateProject" reducer that allows
      // updating the whole project object instead of dispatching updates one by one...

      if (path === 'scene.json') {
        updateProject(project);
      }

      if (path === 'scene.json' || path.endsWith('.composite')) {
        updateThumbnail(project, cbParams);
      }
    },
    [workspaceActions.setProjectTitle, project],
  );

  const updateProject = useCallback(
    (updatedProject: Project) => {
      if (!project || !updatedProject || project.path !== updatedProject.path) return;

      dispatch(workspaceActions.updateProject(updatedProject));
    },
    [workspaceActions.updateProject, project],
  );

  return {
    ...editor,
    startInspector,
    runScene,
    publishScene,
    openPreview,
    openCode,
    updateScene,
    updateProject,
  };
};
