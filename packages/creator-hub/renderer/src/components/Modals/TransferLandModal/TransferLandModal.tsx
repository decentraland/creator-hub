import { useCallback, useState } from 'react';

import type { Address } from 'viem';
import { useAuth } from '/@/hooks/useAuth';
import { useLandTxFlow } from '/@/hooks/useLandTxFlow';
import type { Land } from '/@/lib/land';
import { buildTransferLand } from '/@/lib/landTransactions';
import type { AppState } from '/@/modules/store';
import { t } from '/@/modules/store/translation/utils';

import { RecipientField, type Recipient } from '../../ManagePage/RecipientField';
import { DefaultModal } from '../DefaultModal';
import { TxState, txCorner } from '../TxState';
import { useTxResultSnackbar } from '../TxState/useTxResultSnackbar';

type Props = {
  open: boolean;
  land: Land;
  name: string;
  onClose: () => void;
};

/** Transfers a LAND to a wallet address or NAME owner. */
export function TransferLandModal({ open, land, name, onClose }: Props) {
  const { wallet = '' } = useAuth();
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const isApplied = useCallback(
    (state: AppState) => !state.land.data.some(item => item.id === land.id),
    [land.id],
  );
  const { flow, start, retry, reset } = useLandTxFlow({ isApplied });
  const doneText = t('tx.done.transfer');
  useTxResultSnackbar({ open, flow, doneText });

  const close = () => {
    if (!flow || flow.phase === 'done') reset();
    setRecipient(null);
    onClose();
  };

  return (
    <DefaultModal
      corner={txCorner(flow)}
      open={open}
      title={t('land_transfer.title')}
      onClose={close}
      body={
        flow ? undefined : t('land_transfer.body', { name, b: (chunks: string) => <b>{chunks}</b> })
      }
      initialFocus="content"
      secondary={flow ? undefined : { label: t('modal.cancel'), onClick: close }}
      primary={
        flow
          ? undefined
          : {
              label: t('land_transfer.confirm'),
              state: recipient ? 'idle' : 'blocked',
              onClick: () =>
                recipient &&
                void start([buildTransferLand(land, wallet as Address, recipient.address)]),
            }
      }
    >
      {flow ? (
        <TxState
          flow={flow}
          doneText={doneText}
          onRetry={() => void retry()}
          onClose={close}
        />
      ) : (
        <RecipientField
          purpose="transfer"
          self={wallet}
          autoFocus
          onResolved={setRecipient}
        />
      )}
    </DefaultModal>
  );
}
