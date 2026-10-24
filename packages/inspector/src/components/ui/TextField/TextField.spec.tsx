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
