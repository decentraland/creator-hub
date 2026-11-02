import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { Pill } from '.';

describe('when a Pill renders its remove control', () => {
  it('should expose it as a button named after what it removes', () => {
    render(
      <Pill
        content="state.score"
        removeLabel="Unbind state.score from Text"
        onRemove={vi.fn()}
      />,
    );

    // A native <button> is what makes Enter/Space work; a focusable <div> or an
    // svg with onClick would satisfy the name but stay mouse-only.
    expect(screen.getByRole('button', { name: 'Unbind state.score from Text' }).tagName).toBe(
      'BUTTON',
    );
  });

  it('should call onRemove when activated', () => {
    const onRemove = vi.fn();
    render(
      <Pill
        content="state.score"
        removeLabel="Unbind state.score from Text"
        onRemove={onRemove}
      />,
    );

    fireEvent.click(screen.getByRole('button'));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
