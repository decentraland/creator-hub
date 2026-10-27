import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RelayError } from '/@/lib/auth';
import { sendLandTransaction, type LandTransaction } from '/@/lib/landTransactions';
import { pollUntil } from '/shared/utils';

import { createTestStore } from '../../tests/utils/testStore';
import { useLandTxFlow } from './useLandTxFlow';

vi.mock('/@/lib/landTransactions', () => ({ sendLandTransaction: vi.fn() }));
vi.mock('/shared/utils', async importOriginal => ({
  ...(await importOriginal<object>()),
  pollUntil: vi.fn(async () => true),
}));

const LAND_TX: LandTransaction = { to: '0x0000000000000000000000000000000000000001', data: '0x01' };
const ESTATE_TX: LandTransaction = {
  to: '0x0000000000000000000000000000000000000002',
  data: '0x02',
};
const HASH = `0x${'ab'.repeat(32)}` as const;

const confirm = () =>
  vi.mocked(sendLandTransaction).mockImplementationOnce(async (_tx, options) => {
    options?.onSent?.(HASH);
    return { hash: HASH, status: 'confirmed' };
  });

function renderFlow(refetch?: () => Promise<unknown>) {
  const store = createTestStore();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store as never}>{children}</Provider>
  );
  return renderHook(() => useLandTxFlow({ isApplied: () => true, refetch }), { wrapper });
}

describe('useLandTxFlow', () => {
  afterEach(() => {
    vi.mocked(sendLandTransaction).mockReset();
  });

  describe('when both steps confirm', () => {
    it('should end done on step 2 of 2 and refetch until applied', async () => {
      confirm();
      confirm();
      const { result } = renderFlow();

      await act(() => result.current.start([LAND_TX, ESTATE_TX]));

      expect(result.current.flow).toEqual({ phase: 'done', hash: HASH, step: { n: 2, total: 2 } });
      expect(pollUntil).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the caller refetches something else than the LAND list', () => {
    it('should poll with its refetch', async () => {
      vi.mocked(pollUntil).mockImplementationOnce(async check => check());
      confirm();
      const refetch = vi.fn(async () => {});
      const { result } = renderFlow(refetch);

      await act(() => result.current.start([LAND_TX]));

      expect(refetch).toHaveBeenCalled();
    });
  });

  describe('when a single transaction confirms', () => {
    it('should carry no step', async () => {
      confirm();
      const { result } = renderFlow();

      await act(() => result.current.start([LAND_TX]));

      expect(result.current.flow).toEqual({ phase: 'done', hash: HASH });
    });
  });

  describe('when the second step is rejected in the wallet', () => {
    let flow: ReturnType<typeof renderFlow>;

    beforeEach(async () => {
      confirm();
      vi.mocked(sendLandTransaction).mockRejectedValueOnce(new RelayError('rejected', 'no'));
      flow = renderFlow();
      await act(() => flow.result.current.start([LAND_TX, ESTATE_TX]));
    });

    it('should stop on step 2 as rejected', () => {
      expect(flow.result.current.flow).toEqual({ phase: 'rejected', step: { n: 2, total: 2 } });
    });

    it('should retry only the step that failed', async () => {
      confirm();

      await act(() => flow.result.current.retry());

      expect(vi.mocked(sendLandTransaction).mock.calls.at(-1)?.[0]).toBe(ESTATE_TX);
      expect(flow.result.current.flow?.phase).toBe('done');
    });
  });

  describe.each([
    ['the request expires', () => Promise.reject(new RelayError('expired', 'late')), 'expired'],
    ['the relay errors', () => Promise.reject(new Error('boom')), 'failed'],
    [
      'the receipt reverts',
      () => Promise.resolve({ hash: HASH, status: 'failed' as const }),
      'failed',
    ],
    [
      'no receipt arrives',
      () => Promise.resolve({ hash: HASH, status: 'unconfirmed' as const }),
      'unconfirmed',
    ],
  ])('when %s', (_, outcome, phase) => {
    it(`should end ${phase}`, async () => {
      vi.mocked(sendLandTransaction).mockImplementationOnce(outcome);
      const { result } = renderFlow();

      await act(() => result.current.start([LAND_TX]));

      expect(result.current.flow?.phase).toBe(phase);
    });
  });
});
