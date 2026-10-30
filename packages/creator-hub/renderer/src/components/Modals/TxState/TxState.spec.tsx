import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { misc } from '#preload';
import type { TxFlow } from '/@/hooks/useLandTxFlow';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { DefaultModal } from '../DefaultModal';
import { getExplorerTxUrl, TxState } from '.';

const HASH = `0x${'ab'.repeat(32)}` as const;

function renderState(flow: TxFlow, stepLabels?: string[]) {
  const handlers = { onRetry: vi.fn(), onClose: vi.fn() };
  render(
    <ThemeProvider theme={dark}>
      <TxState
        flow={flow}
        doneText="LAND transferred."
        stepLabels={stepLabels}
        {...handlers}
      />
    </ThemeProvider>,
  );
  return handlers;
}

describe('getExplorerTxUrl', () => {
  it('should point mainnet at etherscan and Sepolia at its own explorer', () => {
    expect(getExplorerTxUrl(HASH, 1)).toBe(`https://etherscan.io/tx/${HASH}`);
    expect(getExplorerTxUrl(HASH, 11155111)).toBe(`https://sepolia.etherscan.io/tx/${HASH}`);
  });
});

describe('TxState', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(cleanup);

  describe('when waiting for the signature', () => {
    it('should ask to confirm in the browser and offer only Cancel', () => {
      const { onClose } = renderState({ phase: 'signing' });

      expect(screen.getByRole('status').textContent).toBe(
        'Confirm this transaction in your browser.',
      );
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalled();
      expect(screen.queryByRole('link')).toBeNull();
    });
  });

  describe('when the transaction is pending', () => {
    it('should link to the explorer', () => {
      renderState({ phase: 'pending', hash: HASH });

      fireEvent.click(screen.getByRole('link', { name: 'View on Etherscan' }));

      expect(misc.openExternal).toHaveBeenCalledWith(expect.stringContaining(`/tx/${HASH}`));
    });
  });

  describe('when it is done', () => {
    it("should show the action's done text", () => {
      renderState({ phase: 'done', hash: HASH });

      expect(screen.getByRole('status').textContent).toBe('LAND transferred.');
      expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    });
  });

  describe('when the request was rejected', () => {
    it('should offer Try again, focused, and retry from it', () => {
      const { onRetry } = renderState({ phase: 'rejected' });

      const retry = screen.getByRole('button', { name: 'Try again' });
      expect(document.activeElement).toBe(retry);
      fireEvent.click(retry);
      expect(onRetry).toHaveBeenCalled();
    });
  });

  describe('when a step before the last one is not confirmed yet', () => {
    it('should offer Continue, which moves on to the next step', () => {
      const { onRetry } = renderState({
        phase: 'unconfirmed',
        hash: HASH,
        step: { n: 1, total: 2 },
      });

      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      expect(onRetry).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    });
  });

  describe('when the last step is not confirmed yet', () => {
    it('should offer only Close', () => {
      renderState({ phase: 'unconfirmed', hash: HASH, step: { n: 2, total: 2 } });

      expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    });
  });

  describe.each<[string, TxFlow, string[]]>([
    ['waiting for the signature', { phase: 'signing' }, ['Cancel']],
    ['pending', { phase: 'pending', hash: HASH }, ['Close']],
    ['done', { phase: 'done', hash: HASH }, ['Close']],
    ['not confirmed on the last step', { phase: 'unconfirmed', hash: HASH }, ['Close']],
    [
      'not confirmed with a later step',
      { phase: 'unconfirmed', hash: HASH, step: { n: 1, total: 2 } },
      ['Close', 'Continue'],
    ],
    ['rejected', { phase: 'rejected' }, ['Cancel', 'Try again']],
    ['expired', { phase: 'expired' }, ['Cancel', 'Try again']],
    ['failed', { phase: 'failed', hash: HASH }, ['Close', 'Try again']],
  ])('when it is %s', (_, flow, labels) => {
    it(`should offer ${labels.join(', then ')}`, () => {
      renderState(flow);

      expect(screen.getAllByRole('button').map(button => button.textContent)).toEqual(labels);
    });
  });

  describe('when it shows a Secondary and a Primary', () => {
    it("should draw them as its DefaultModal's own pair", () => {
      renderState({ phase: 'rejected' });
      render(
        <ThemeProvider theme={dark}>
          <DefaultModal
            open
            title="Host"
            corner="none"
            onClose={vi.fn()}
            secondary={{ label: 'Back', onClick: vi.fn() }}
            primary={{ label: 'Go', state: 'idle', onClick: vi.fn() }}
          />
        </ThemeProvider>,
      );

      expect(screen.getByRole('button', { name: 'Cancel', hidden: true }).className).toBe(
        screen.getByRole('button', { name: 'Back' }).className,
      );
      expect(screen.getByRole('button', { name: 'Try again', hidden: true }).className).toBe(
        screen.getByRole('button', { name: 'Go' }).className,
      );
    });
  });

  describe('when it is one step of several', () => {
    it('should say which step, with its label', () => {
      renderState({ phase: 'signing', step: { n: 2, total: 2 } }, ['LAND', 'Estates']);

      expect(screen.getByText('Step 2 of 2 · Estates')).toBeTruthy();
    });
  });
});
