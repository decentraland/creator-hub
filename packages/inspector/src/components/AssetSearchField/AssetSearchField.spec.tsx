import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AssetSearchField } from './AssetSearchField';

describe('when the search is reset from outside while a keystroke is still debouncing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('should keep the reset instead of reporting the stale text', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <AssetSearchField
        value="tree"
        placeholder="Search"
        onChange={onChange}
        debounceMs={300}
      />,
    );
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'trees' } });
    rerender(
      <AssetSearchField
        value=""
        placeholder="Search"
        onChange={onChange}
        debounceMs={300}
      />,
    );
    act(() => vi.advanceTimersByTime(300));
    expect(onChange).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Search') as HTMLInputElement).value).toBe('');
  });
});
