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

/** Sends LAND transactions in order and tracks their TxState phase; `retry` resumes at the failed step, or after an unconfirmed one; the LAND list refetches until `isApplied`. `reset` stops the flow's updates and its remaining steps. */
export function useLandTxFlow({
  isApplied,
  refetch,
}: {
  isApplied: (state: AppState) => boolean;
  refetch?: () => Promise<unknown>;
}) {
  const [flow, setFlowState] = useState<TxFlow | null>(null);
  const resume = useRef<{ txs: LandTransaction[]; from: number }>({ txs: [], from: 0 });
  const runId = useRef(0);
  const dispatch = useDispatch();
  const store = useStore<AppState>();
  const refresh = useCallback(
    () => (refetch ? refetch() : dispatch(managementActions.fetchLandProjects())),
    [refetch, dispatch],
  );

  const run = useCallback(
    async (txs: LandTransaction[], from: number) => {
      const id = ++runId.current;
      const live = () => runId.current === id;
      const setFlow = (next: TxFlow) => live() && setFlowState(next);
      resume.current = { txs, from };
      for (let index = from; index < txs.length; index++) {
        if (!live()) {
          void refresh();
          return;
        }
        const step = txs.length > 1 ? { step: { n: index + 1, total: txs.length } } : {};
        resume.current.from = index;
        setFlow({ phase: 'signing', ...step });
        try {
          const { hash, status } = await sendLandTransaction(txs[index], {
            onSent: sent => setFlow({ phase: 'pending', hash: sent, ...step }),
          });
          if (status !== 'confirmed') {
            setFlow({ phase: status === 'failed' ? 'failed' : 'unconfirmed', hash, ...step });
            if (status === 'unconfirmed') resume.current.from = index + 1;
            void refresh();
            return;
          }
          if (index === txs.length - 1) setFlow({ phase: 'done', hash, ...step });
        } catch (error) {
          setFlow({ phase: failurePhase(error), ...step });
          if (index > 0) void refresh();
          return;
        }
      }
      await pollUntil(async () => {
        await refresh();
        return isApplied(store.getState());
      }, REFETCH);
    },
    [store, isApplied, refresh],
  );

  return {
    flow,
    start: useCallback((txs: LandTransaction[]) => run(txs, 0), [run]),
    retry: useCallback(() => run(resume.current.txs, resume.current.from), [run]),
    reset: useCallback(() => {
      runId.current++;
      setFlowState(null);
    }, []),
  };
}
