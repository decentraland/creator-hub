import { useCallback } from 'react';

import { editor as editorApi } from '#preload';
import { useDispatch, useSelector } from '#store';

import type { Project } from '/shared/types/projects';
import type { DeployOptions } from '/shared/types/ipc';

import { actions as editorActions } from '/@/modules/store/editor';
import { actions as workspaceActions } from '/@/modules/store/workspace';
import { bufferToScene } from '/@/modules/buffer';
import type { Method, Params } from '/@/modules/rpc/storage';
import { useScene } from './useScene';
import type { CallbackParams } from '../modules/rpc';

export const useEditor = () => {
  const dispatch = useDispatch();
  const { updateTitle, updateThumbnail } = useScene();
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
      if (editor.previewPort > 0) {
        dispatch(editorActions.openPreview(editor.previewPort));
      } else {
        dispatch(editorActions.runSceneAndOpenPreview(project));
      }
    }
  }, [
    editorActions.openPreview,
    editorActions.runSceneAndOpenPreview,
    project,
    editor.previewPort,
  ]);

  const openCode = useCallback(() => {
    if (project) {
      editorApi.openCode(project.path);
    }
  }, [editorApi.openCode, project]);

  const updateScene = useCallback(
    async (cbParams: CallbackParams, { path, content }: Params[Method.WRITE_FILE]) => {
      if (!project) return;

      // TODO: we could alternatively have an "updateProject" reducer that allows
      // updating the whole project object instead of dispatching updates one by one...

      if (path === 'scene.json') {
        updateTitle(project, bufferToScene(content));
      }

      if (path === 'scene.json' || path.endsWith('.composite')) {
        updateThumbnail(project, cbParams);
      }
    },
    [workspaceActions.setProjectTitle, project],
  );

  return {
    ...editor,
    project,
    startInspector,
    runScene,
    publishScene,
    openPreview,
    openCode,
    updateScene,
  };
};
