import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from '#store';
import { actions } from '/@/modules/store/editor';
import { useWorkspace } from './useWorkspace';

export const useEditor = () => {
  const dispatch = useDispatch();
  const editor = useSelector(state => state.editor);
  const [search] = useSearchParams();
  const path = useMemo(() => search.get('path'), [search]);
  const workspace = useWorkspace();
  const project = useMemo(() => {
    return workspace.projects.find(project => project.path === path);
  }, [workspace.projects, path]);

  const startInspector = useCallback(() => {
    dispatch(actions.startInspector());
  }, [dispatch, actions.startInspector]);

  const runScene = useCallback(() => {
    if (project) {
      dispatch(actions.runScene(project.path));
    }
  }, [project]);

  const publishScene = useCallback(() => {
    if (project) {
      dispatch(actions.publishScene(project.path));
    }
  }, [project, actions.publishScene]);

  const openPreview = useCallback(() => {
    if (editor.previewPort) {
      dispatch(actions.openPreview(editor.previewPort));
    }
  }, [editor.previewPort, actions.openPreview]);

  return {
    ...editor,
    project,
    startInspector,
    runScene,
    publishScene,
    openPreview,
  };
};
