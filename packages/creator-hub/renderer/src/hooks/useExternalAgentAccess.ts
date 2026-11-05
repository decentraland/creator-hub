import { useEffect } from 'react';

import { ai } from '#preload';
import { actions as snackbarActions } from '/@/modules/store/snackbar';
import { createCustomNotification } from '/@/modules/store/snackbar/utils';
import { useDispatch } from '#store';

// One id, so repeated requests replace the notice instead of stacking copies of it.
export const EXTERNAL_AGENT_ACCESS_NOTICE_ID = 'external-agent-access';

/**
 * When an AI agent outside Creator Hub asks for access to the MCP server, ask the creator with
 * a notice that stays until they answer. Nothing is granted unless they click Allow. Checked on
 * mount too, so a request made while the window was still loading (or the Hub was closed)
 * isn't missed.
 */
export function useExternalAgentAccess() {
  const dispatch = useDispatch();

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      void ai.takeExternalAccessRequest().then(
        requested => {
          if (cancelled || !requested) return;
          dispatch(
            snackbarActions.pushSnackbar(
              createCustomNotification(
                { type: 'external-agent-access' },
                { duration: 0, requestId: EXTERNAL_AGENT_ACCESS_NOTICE_ID },
              ),
            ),
          );
        },
        () => {},
      );
    };
    check();
    const { cleanup } = ai.onExternalAccessRequested(check);
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [dispatch]);
}
