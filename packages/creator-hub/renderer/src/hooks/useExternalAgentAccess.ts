import { useEffect } from 'react';

import { ai } from '#preload';
import { actions as snackbarActions } from '/@/modules/store/snackbar';
import { createCustomNotification } from '/@/modules/store/snackbar/utils';
import { actions as workspaceActions } from '/@/modules/store/workspace';
import { useDispatch } from '#store';

/**
 * When an AI agent outside Creator Hub turns on its own access to the MCP server, main saves
 * the setting and lets us know. Mirror the setting into the store and tell the creator, with a
 * notice that stays until dismissed. Checked on mount too, so a request honoured while the
 * window was still loading isn't missed.
 */
export function useExternalAgentAccess() {
  const dispatch = useDispatch();

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      void ai.takeExternalAccessGrant().then(
        granted => {
          if (cancelled || !granted) return;
          dispatch(workspaceActions.setExposeMcpServer(true));
          dispatch(
            snackbarActions.pushSnackbar(
              createCustomNotification({ type: 'external-agent-access' }, { duration: 0 }),
            ),
          );
        },
        () => {},
      );
    };
    check();
    const { cleanup } = ai.onExternalAccessChanged(check);
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [dispatch]);
}
