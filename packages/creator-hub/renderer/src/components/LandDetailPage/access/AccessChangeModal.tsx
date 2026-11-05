import { useCallback, type ReactNode } from 'react';

import { useLandTxFlow } from '/@/hooks/useLandTxFlow';
import type { Land } from '/@/lib/land';
import type { LandTransaction } from '/@/lib/landTransactions';
import type { AppState } from '/@/modules/store';
import { t } from '/@/modules/store/translation/utils';

import { DefaultModal } from '../../Modals/DefaultModal';
import { TxState, txCorner } from '../../Modals/TxState';

export type AccessRequest = {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  doneText: string;
  txs: LandTransaction[];
  isApplied: (state: AppState) => boolean;
  stepLabels?: string[];
};

/** Confirms an access change, then follows its transactions. */
export function AccessChangeModal({
  request,
  onClose,
}: {
  request: AccessRequest;
  onClose: () => void;
}) {
  const isApplied = useCallback((state: AppState) => request.isApplied(state), [request]);
  const { flow, start, retry } = useLandTxFlow({ isApplied });

  return (
    <DefaultModal
      corner={txCorner(flow)}
      open
      title={request.title}
      onClose={onClose}
      body={flow ? undefined : request.body}
      secondary={flow ? undefined : { label: t('modal.cancel'), onClick: onClose }}
      primary={
        flow
          ? undefined
          : { label: request.confirmLabel, state: 'idle', onClick: () => void start(request.txs) }
      }
    >
      {flow && (
        <TxState
          flow={flow}
          doneText={request.doneText}
          stepLabels={request.stepLabels}
          onRetry={() => void retry()}
          onClose={onClose}
        />
      )}
    </DefaultModal>
  );
}

/** Looks the LAND up in the store, for an `isApplied` check after a refetch. */
export const landIn = (state: AppState, id: string): Land | undefined =>
  state.land.data.find(item => item.id === id);
