import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { WalletList } from '.';

const ADDRESS = '0x0000000000000000000000000000000000000001';

function setup(value: string[], onChange = vi.fn()) {
  const utils = render(
    <WalletList
      label="Server Logs"
      addLabel="Add Address"
      removeLabel="Remove Address"
      value={value}
      onChange={onChange}
    />,
  );
  return { ...utils, onChange };
}

describe('when a WalletList renders its rows', () => {
  it('should name each field by its position', () => {
    setup(['', ADDRESS]);

    expect(screen.getByLabelText('Wallet address 1')).toBeDefined();
    expect(screen.getByLabelText('Wallet address 2')).toBeDefined();
  });

  it('should show the committed address truncated once it changes', () => {
    const { rerender, onChange } = setup(['']);
    rerender(
      <WalletList
        label="Server Logs"
        addLabel="Add Address"
        removeLabel="Remove Address"
        value={[ADDRESS]}
        onChange={onChange}
      />,
    );

    expect((screen.getByLabelText('Wallet address 1') as HTMLInputElement).value).toBe(
      '0x0000000000...00000001',
    );
  });
});

describe('when a WalletList row is edited', () => {
  it('should report the whole list on blur', () => {
    const { onChange } = setup(['']);
    const input = screen.getByLabelText('Wallet address 1');

    fireEvent.change(input, { target: { value: ADDRESS } });
    fireEvent.blur(input, { target: { value: ADDRESS } });

    expect(onChange).toHaveBeenCalledWith([ADDRESS]);
  });

  it('should append an empty row when the add control is used', () => {
    const { onChange } = setup([ADDRESS]);

    fireEvent.click(screen.getByText('Add Address'));

    expect(onChange).toHaveBeenCalledWith([ADDRESS, '']);
  });

  it('should remove the row named by its position', () => {
    const { container, onChange } = setup([ADDRESS, '']);

    fireEvent.click(container.querySelectorAll('.MoreOptionsButton')[1]);
    fireEvent.click(screen.getByLabelText('Remove Address 2'));

    expect(onChange).toHaveBeenCalledWith([ADDRESS]);
  });
});
