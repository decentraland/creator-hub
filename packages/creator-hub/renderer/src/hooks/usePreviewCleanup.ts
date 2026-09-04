import { useEffect } from 'react';

import { actions as editorActions } from '/@/modules/store/editor';
import { useDispatch } from '#store';

/** Kills the running preview of `path` whenever the editor leaves it: unmount or project switch. */
export function usePreviewCleanup(path: string | undefined) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (!path) return;
    return () => {
      void dispatch(editorActions.killPreviewScene(path));
    };
  }, [path, dispatch]);
}
