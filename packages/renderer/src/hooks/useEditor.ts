import { useCallback } from 'react';

import { editor as editorApi } from '#preload';
import { useDispatch, useSelector } from '#store';

import type { DeployOptions } from '/shared/types/ipc';
import { actions } from '/@/modules/store/editor';

export const useEditor = () => {
  const dispatch = useDispatch();
  const editor = useSelector(state => state.editor);
  const { project } = editor;

  const startInspector = useCallback(() => {
    dispatch(actions.startInspector());
  }, [dispatch, actions.startInspector]);

  const runScene = useCallback(() => {
    if (project) {
      dispatch(actions.runScene(project.path));
    }
  }, [project]);

  const publishScene = useCallback(
    (opts: Omit<DeployOptions, 'path'> = {}) => {
      if (project) {
        dispatch(actions.publishScene({ ...opts, path: project.path }));
      }
    },
    [project, actions.publishScene],
  );

  const openPreview = useCallback(() => {
    if (editor.previewPort) {
      dispatch(actions.openPreview(editor.previewPort));
    }
  }, [editor.previewPort, actions.openPreview]);

  const openCode = useCallback(() => {
    if (project) {
      editorApi.openCode(project.path);
    }
  }, [project]);

  return {
    ...editor,
    project,
    startInspector,
    runScene,
    publishScene,
    openPreview,
    openCode,
  };
};
