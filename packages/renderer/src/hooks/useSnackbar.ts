import { useCallback, type SyntheticEvent } from 'react';
import { type SnackbarCloseReason } from 'decentraland-ui2';

import { useDispatch, useSelector } from '#store';
import { actions } from '/@/modules/store/snackbar';
import type {
  CustomNotification,
  DependencyNotification,
  Notification,
  Opts,
  Severity,
} from '/@/modules/store/snackbar/types';

export function useSnackbar() {
  const dispatch = useDispatch();
  const snackbar = useSelector(state => state.snackbar);

  const dismiss = useCallback(
    (id: Notification['id'], idx: number, project?: DependencyNotification['project']) =>
      (_: SyntheticEvent<any> | Event, reason: SnackbarCloseReason) => {
        if (reason === 'timeout') dispatch(actions.removeSnackbar({ id, project }));
        if (reason === 'escapeKeyDown' && idx === 0) {
          const first = snackbar.notifications[0];
          dispatch(actions.removeSnackbar({ id: first.id, project }));
        }
      },
    [snackbar.notifications],
  );

  const close = useCallback(
    (id: Notification['id'], project?: DependencyNotification['project']) => () => {
      dispatch(actions.removeSnackbar({ id, project }));
    },
    [],
  );

  const createGenericNotification = useCallback(
    (severity: Severity, message: string, opts?: Opts) => {
      dispatch(actions.createGenericNotification({ severity, message, opts }));
    },
    [],
  );

  const createCustomNotification = useCallback((type: CustomNotification['type'], opts?: Opts) => {
    dispatch(actions.createCustomNotification({ type, opts }));
  }, []);

  const createDependencyNotification = useCallback(
    (
      type: DependencyNotification['type'],
      project: DependencyNotification['project'],
      opts?: Opts,
    ) => {
      dispatch(actions.createDependencyNotification({ type, project, opts }));
    },
    [],
  );

  return {
    ...snackbar,
    close,
    dismiss,
    createGenericNotification,
    createCustomNotification,
    createDependencyNotification,
  };
}
