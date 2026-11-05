import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { WalletField } from '.';

const CHECKSUMMED = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';

function setup(value = '') {
  const onChange = vi.fn();
  render(
    <WalletField
      aria-label="Wallet"
      value={value}
      onChange={onChange}
    />,
  );
  const input = screen.getByLabelText('Wallet') as HTMLInputElement;
  const committed = () => onChange.mock.calls.map(([event]) => event.target.value);
  return { input, committed };
}

describe('WalletField', () => {
  describe('when a pasted address is confirmed with Enter', () => {
    it('should commit it without waiting for blur', () => {
      const { input, committed } = setup();

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: CHECKSUMMED } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(committed()).toEqual([CHECKSUMMED]);
    });
  });

  describe('when the pasted address carries surrounding spaces', () => {
    it('should commit the trimmed address instead of flagging it', () => {
      const { input, committed } = setup();

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: ` ${CHECKSUMMED}\n` } });
      fireEvent.blur(input);

      expect(committed()).toEqual([CHECKSUMMED]);
      expect(screen.queryByText('Not a valid Ethereum address.')).toBeNull();
    });
  });

  describe('when a stored address is focused and left without edits', () => {
    it('should show the full address while focused and commit it unchanged', () => {
      const { input, committed } = setup(CHECKSUMMED);
      expect(input.value).toBe('0x5aAeb6053F...Ef1BeAed');

      fireEvent.focus(input);
      expect(input.value).toBe(CHECKSUMMED);
      fireEvent.blur(input);

      expect(committed()).toEqual([CHECKSUMMED]);
      expect(screen.queryByText('Not a valid Ethereum address.')).toBeNull();
    });
  });

  describe('when the text is not an address', () => {
    it('should show one error and commit nothing', () => {
      const { input, committed } = setup();

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '0x123' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.blur(input);

      expect(committed()).toEqual([]);
      expect(screen.getAllByText('Not a valid Ethereum address.')).toHaveLength(1);
    });
  });
});
