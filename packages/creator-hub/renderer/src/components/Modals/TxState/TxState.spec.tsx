import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { misc } from '#preload';
import type { TxFlow } from '/@/hooks/useLandTxFlow';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

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

  describe('when it is one step of several', () => {
    it('should say which step, with its label', () => {
      renderState({ phase: 'signing', step: { n: 2, total: 2 } }, ['LAND', 'Estates']);

      expect(screen.getByText('Step 2 of 2 · Estates')).toBeTruthy();
    });
  });
});
