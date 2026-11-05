import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';

import { TextField } from '.';

function getInput(container: HTMLElement): HTMLInputElement {
  const el = container.querySelector('input');
  if (!el) throw new Error('input not rendered');
  return el;
}

function type(input: HTMLInputElement, text: string) {
  fireEvent.focus(input);
  for (let i = 1; i <= text.length; i++) {
    fireEvent.change(input, { target: { value: text.slice(0, i) } });
  }
}

describe('TextField committing on blur only', () => {
  describe('when typing with no onChange handler wired', () => {
    it('should still display every typed character', () => {
      const { container } = render(<TextField value="Door" />);
      const input = getInput(container);

      type(input, 'metalcase');

      expect(input.value).toBe('metalcase');
    });

    it('should report the whole value once on blur', () => {
      const onBlur = vi.fn();
      const { container } = render(
        <TextField
          value="Door"
          onBlur={onBlur}
        />,
      );
      const input = getInput(container);

      type(input, 'metalcase');
      fireEvent.blur(input);

      expect(onBlur).toHaveBeenCalledTimes(1);
      expect(onBlur.mock.lastCall?.[0].target.value).toBe('metalcase');
    });

    it('should not revert to the pre-edit prop while the commit round-trips', () => {
      const { container, rerender } = render(<TextField value="Door" />);
      const input = getInput(container);

      type(input, 'metalcase');
      fireEvent.blur(input);
      rerender(<TextField value="Door" />);

      expect(getInput(container).value).toBe('metalcase');
    });
  });
});

describe('TextField when the parent swaps the value as focus begins', () => {
  function Swapping({ full, short }: { full: string; short: string }) {
    const [focused, setFocused] = React.useState(false);
    return (
      <TextField
        value={focused ? full : short}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    );
  }

  it('should show the editable value once focused', () => {
    const { container } = render(
      <Swapping
        full="0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"
        short="0x5aAeb6053F...Ef1BeAed"
      />,
    );
    const input = getInput(container);

    fireEvent.focus(input);

    expect(input.value).toBe('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed');
  });

  it('should still ignore a value change that arrives while typing', () => {
    const { container, rerender } = render(<TextField value="Door" />);
    const input = getInput(container);

    type(input, 'metal');
    rerender(<TextField value="Gate" />);

    expect(input.value).toBe('metal');
  });
});
