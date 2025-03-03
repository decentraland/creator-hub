import { useCallback } from 'react';

import { editor as editorApi } from '#preload';
import { useDispatch, useSelector } from '#store';

import type { DeployOptions } from '/shared/types/ipc';
import type { PreviewOptions } from '/shared/types/settings';

import { actions as editorActions } from '/@/modules/store/editor';
import { actions as workspaceActions } from '/@/modules/store/workspace';
import type { Method, Params } from '/@/modules/rpc/storage';
import type { RPCInfo } from '/@/modules/rpc';
import { bufferToScene } from '/@/modules/buffer';
import { useInspector } from '/@/hooks/useInspector';
import { stripBase64ImagePrefix } from '/@/modules/image';

export const useEditor = () => {
  const dispatch = useDispatch();
  const { generateThumbnail } = useInspector();
  const editor = useSelector(state => state.editor);
  const { project } = editor;

  const startInspector = useCallback(() => {
    dispatch(editorActions.startInspector());
  }, [dispatch, editorActions.startInspector]);

  const publishScene = useCallback(
    (opts: Omit<DeployOptions, 'path'> = {}) => {
      if (project) {
        dispatch(editorActions.publishScene({ ...opts, path: project.path }));
      }
    },
    [project, editorActions.publishScene],
  );

  const openPreview = useCallback(
    (opts: PreviewOptions) => {
      if (project) {
        dispatch(editorActions.runScene({ path: project.path, ...opts }));
      }
    },
    [project, editorActions.runScene],
  );

  const killPreview = useCallback(() => {
    if (project) {
      dispatch(editorActions.killPreviewScene(project.path));
    }
  }, [project, editorActions.killPreviewScene]);

  const openCode = useCallback(() => {
    if (project) {
      editorApi.openCode(project.path);
    }
  }, [editorApi.openCode, project]);

  const updateScene = useCallback(
    async (_: RPCInfo, { path, content }: Params[Method.WRITE_FILE]) => {
      // INFO: scene files are already updated since rpc storage writes to them on every change,
      // so no data is lost if we don't do anything here, only runtime state will be out of sync.
      // Based on that, we could just update state for the project where needed, and let everything as is.
      // Then on go-back we can re-fetch the project so we keep everything synced...
      // TODO OPTIMIZATION: maybe we can debounce this?
      if (project && path === 'scene.json') {
        const scene = bufferToScene(content);
        dispatch(
          workspaceActions.updateProject({
            ...project,
            title: scene.display?.title || project.title,
            scene: scene.scene,
          }),
        );
      }
    },
    [workspaceActions.updateProject, project],
  );

  const saveAndGetThumbnail = useCallback(async (rpcInfo: RPCInfo) => {
    const thumbnail = await generateThumbnail(rpcInfo);
    if (thumbnail) {
      const data = { path: rpcInfo.project.path, thumbnail: stripBase64ImagePrefix(thumbnail) };
      return dispatch(workspaceActions.saveAndGetThumbnail(data)).unwrap();
    }
  }, []);

  // TODO: find a proper name for this function
  const refreshProject = useCallback(
    async (rpcInfo: RPCInfo) => {
      const _ = await saveAndGetThumbnail(rpcInfo);
      dispatch(workspaceActions.getProject(rpcInfo.project.path));
    },
    [workspaceActions.getProject, project],
  );

  return {
    ...editor,
    startInspector,
    publishScene,
    openPreview,
    killPreview,
    openCode,
    updateScene,
    saveAndGetThumbnail,
    refreshProject,
  };
};
