import { useCallback, type ReactNode } from 'react';

import { useLandTxFlow } from '/@/hooks/useLandTxFlow';
import type { Land } from '/@/lib/land';
import type { LandTransaction } from '/@/lib/landTransactions';
import type { AppState } from '/@/modules/store';
import { t } from '/@/modules/store/translation/utils';

import { DefaultModal, type ModalStep } from '../../Modals/DefaultModal';
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

/** The DefaultModal content that confirms an access change, then follows its transactions. */
export function useAccessChange(
  request: AccessRequest | null,
  onClose: () => void,
): ModalStep | undefined {
  const isApplied = useCallback((state: AppState) => !!request?.isApplied(state), [request]);
  const { flow, start, retry } = useLandTxFlow({ isApplied });

  if (!request) return undefined;
  return {
    corner: txCorner(flow),
    title: request.title,
    onClose,
    body: flow ? undefined : request.body,
    secondary: flow ? undefined : { label: t('modal.cancel'), onClick: onClose },
    primary: flow
      ? undefined
      : { label: request.confirmLabel, state: 'idle', onClick: () => void start(request.txs) },
    children: flow && (
      <TxState
        flow={flow}
        doneText={request.doneText}
        stepLabels={request.stepLabels}
        onRetry={() => void retry()}
        onClose={onClose}
      />
    ),
  };
}

/** Confirms an access change, then follows its transactions. */
export function AccessChangeModal({
  request,
  onClose,
}: {
  request: AccessRequest;
  onClose: () => void;
}) {
  const step = useAccessChange(request, onClose);
  return step ? (
    <DefaultModal
      open
      {...step}
    />
  ) : null;
}

/** Looks the LAND up in the store, for an `isApplied` check after a refetch. */
export const landIn = (state: AppState, id: string): Land | undefined =>
  state.land.data.find(item => item.id === id);
