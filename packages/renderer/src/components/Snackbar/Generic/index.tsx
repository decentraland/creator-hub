import { Alert } from 'decentraland-ui2';

import { type GenericNotification } from '/@/modules/store/snackbar/types';

export function Generic({ severity, message }: GenericNotification) {
  return <Alert severity={severity}>{message}</Alert>;
}
