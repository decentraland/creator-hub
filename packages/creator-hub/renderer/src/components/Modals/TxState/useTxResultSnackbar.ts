import { useEffect } from 'react';

import { useSnackbar } from '/@/hooks/useSnackbar';
import type { TxFlow } from '/@/hooks/useLandTxFlow';
import { t } from '/@/modules/store/translation/utils';

const ENDED = new Set(['done', 'unconfirmed', 'rejected', 'expired', 'failed']);

/** Reports a transaction's result in a snackbar when it ends after its modal was closed. */
export function useTxResultSnackbar({
  open,
  flow,
  doneText,
}: {
  open: boolean;
  flow: TxFlow | null;
  doneText: string;
}) {
  const { pushGeneric } = useSnackbar();
  useEffect(() => {
    if (open || !flow || !ENDED.has(flow.phase)) return;
    if (flow.phase === 'done') pushGeneric('success', doneText);
    else pushGeneric('error', t(flow.phase === 'unconfirmed' ? 'tx.not_confirmed' : 'tx.failed'));
  }, [open, flow?.phase]);
}
