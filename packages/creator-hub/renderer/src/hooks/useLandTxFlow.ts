import { useCallback, useRef, useState } from 'react';
import { useStore } from 'react-redux';
import type { Hex } from 'viem';

import { useDispatch } from '#store';
import type { AppState } from '/@/modules/store';
import { RelayError } from '/@/lib/auth';
import { sendLandTransaction, type LandTransaction } from '/@/lib/landTransactions';
import { actions as managementActions } from '/@/modules/store/management';
import { pollUntil } from '/shared/utils';

export type TxPhase =
  | 'signing'
  | 'pending'
  | 'done'
  | 'unconfirmed'
  | 'rejected'
  | 'expired'
  | 'failed';

export type TxFlow = { phase: TxPhase; hash?: Hex; step?: { n: number; total: number } };

const REFETCH = { intervalMs: 3_000, attempts: 10 };

function failurePhase(error: unknown): TxPhase {
  if (error instanceof RelayError && error.reason === 'rejected') return 'rejected';
  if (error instanceof RelayError && error.reason === 'expired') return 'expired';
  return 'failed';
}

/** Sends LAND transactions in order and tracks their TxState phase; `retry` resumes at the failed step; the LAND list refetches until `isApplied`. */
export function useLandTxFlow({
  isApplied,
  refetch,
}: {
  isApplied: (state: AppState) => boolean;
  refetch?: () => Promise<unknown>;
}) {
  const [flow, setFlow] = useState<TxFlow | null>(null);
  const resume = useRef<{ txs: LandTransaction[]; from: number }>({ txs: [], from: 0 });
  const dispatch = useDispatch();
  const store = useStore<AppState>();

  const run = useCallback(
    async (txs: LandTransaction[], from: number) => {
      resume.current = { txs, from };
      for (let index = from; index < txs.length; index++) {
        const step = txs.length > 1 ? { step: { n: index + 1, total: txs.length } } : {};
        resume.current.from = index;
        setFlow({ phase: 'signing', ...step });
        try {
          const { hash, status } = await sendLandTransaction(txs[index], {
            onSent: sent => setFlow({ phase: 'pending', hash: sent, ...step }),
          });
          if (status !== 'confirmed') {
            setFlow({ phase: status === 'failed' ? 'failed' : 'unconfirmed', hash, ...step });
            return;
          }
          if (index === txs.length - 1) setFlow({ phase: 'done', hash, ...step });
        } catch (error) {
          setFlow({ phase: failurePhase(error), ...step });
          if (index > 0) void dispatch(managementActions.fetchLandProjects());
          return;
        }
      }
      await pollUntil(async () => {
        await (refetch ? refetch() : dispatch(managementActions.fetchLandProjects()));
        return isApplied(store.getState());
      }, REFETCH);
    },
    [dispatch, store, isApplied, refetch],
  );

  return {
    flow,
    start: useCallback((txs: LandTransaction[]) => run(txs, 0), [run]),
    retry: useCallback(() => run(resume.current.txs, resume.current.from), [run]),
    reset: useCallback(() => setFlow(null), []),
  };
}
