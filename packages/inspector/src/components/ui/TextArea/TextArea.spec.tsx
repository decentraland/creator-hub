import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';

import { TextArea } from '.';

function getTextArea(container: HTMLElement): HTMLTextAreaElement {
  const el = container.querySelector('textarea');
  if (!el) throw new Error('textarea not rendered');
  return el;
}

describe('TextArea value adoption', () => {
  describe('when the value prop changes externally while unfocused', () => {
    it('should adopt the new value', () => {
      const { container, rerender } = render(<TextArea value="one" />);
      rerender(<TextArea value="two" />);
      expect(getTextArea(container).value).toBe('two');
    });
  });

  describe('when a stale value prop arrives while focused', () => {
    it('should not clobber the typed text', () => {
      const { container, rerender } = render(<TextArea value="initial" />);
      const textarea = getTextArea(container);
      fireEvent.focus(textarea);
      fireEvent.change(textarea, { target: { value: 'typed text' } });
      // A stale external value (e.g. the pre-edit value still in flight on the
      // engine round-trip) must not overwrite what the user is typing.
      rerender(<TextArea value="stale" />);
      expect(getTextArea(container).value).toBe('typed text');
    });
  });

  describe('when the user blurs before the edit round-trips', () => {
    it('should not revert to the unchanged pre-edit prop', () => {
      const { container } = render(<TextArea value="initial" />);
      const textarea = getTextArea(container);
      fireEvent.focus(textarea);
      fireEvent.change(textarea, { target: { value: 'edited' } });
      // On blur the prop still holds "initial" (no external change occurred),
      // so the field must keep the committed local value.
      fireEvent.blur(textarea);
      expect(getTextArea(container).value).toBe('edited');
    });
  });

  describe('when typing', () => {
    it('should fire onChange per keystroke', () => {
      const onChange = vi.fn();
      const { container } = render(
        <TextArea
          value=""
          onChange={onChange}
        />,
      );
      const textarea = getTextArea(container);
      fireEvent.change(textarea, { target: { value: 'a' } });
      fireEvent.change(textarea, { target: { value: 'ab' } });
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(getTextArea(container).value).toBe('ab');
    });
  });
});
