import { useCallback } from 'react';
import { type Scene } from '@dcl/schemas';

import { editor as editorApi } from '#preload';
import { useDispatch, useSelector } from '#store';

import type { Project } from '/shared/types/projects';
import type { Method, Params } from '/@/modules/server';
import { bufferToJson } from '/@/modules/buffer';

import type { DeployOptions } from '/shared/types/ipc';
import { actions as editorActions } from '/@/modules/store/editor';
import { actions as workspaceActions } from '/@/modules/store/workspace';

export const useEditor = () => {
  const dispatch = useDispatch();
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

  const updateSceneTitle = useCallback(
    ({ path, content }: Params[Method.WRITE_FILE]) => {
      if (project && path === 'scene.json') {
        const scene = bufferToJson(content) as Scene;
        const title = scene.display?.title || '';
        dispatch(workspaceActions.setProjectTitle({ path: project.path, title }));
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
    updateSceneTitle,
  };
};
