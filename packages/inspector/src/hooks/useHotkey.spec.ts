import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, cleanup, fireEvent } from '@testing-library/react';

import { useHotkey } from './useHotkey';

afterEach(() => {
  cleanup();
});

const pressF = () => fireEvent.keyDown(document.body, { key: 'f', keyCode: 70 });

describe('when a hotkey is bound', () => {
  it('should run the callback on the key', () => {
    const onKey = vi.fn();
    renderHook(() => useHotkey(['f'], onKey, document.body));

    pressF();

    expect(onKey).toHaveBeenCalledTimes(1);
  });
});

describe('when a hotkey is disabled', () => {
  it('should not run the callback', () => {
    const onKey = vi.fn();
    renderHook(() => useHotkey(['f'], onKey, document.body, { enabled: false }));

    pressF();

    expect(onKey).not.toHaveBeenCalled();
  });

  // The gate has to skip REGISTRATION, not just the callback: the wrapper calls
  // preventDefault() before it dispatches, so a merely-inert binding would still
  // swallow the key from whatever owns the screen instead (the UI Designer).
  it('should leave the key alone rather than swallowing it', () => {
    renderHook(() => useHotkey(['f'], vi.fn(), document.body, { enabled: false }));

    const event = new KeyboardEvent('keydown', {
      key: 'f',
      cancelable: true,
      bubbles: true,
    });
    Object.defineProperty(event, 'keyCode', { value: 70 });
    document.body.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('should bind again once it is re-enabled', () => {
    const onKey = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }) => useHotkey(['f'], onKey, document.body, { enabled }),
      { initialProps: { enabled: false } },
    );

    rerender({ enabled: true });
    pressF();

    expect(onKey).toHaveBeenCalledTimes(1);
  });
});

// hotkeys.unbind(key) drops EVERY handler for that key, across every component.
// Two components sharing a key is normal here (Gizmos and the Renderer both bind
// `f`), so an unscoped unbind on one unmount silently killed the other's binding
// for the rest of the session.
describe('when two components bind the same key', () => {
  it('should keep one binding alive after the other unmounts', () => {
    const stays = vi.fn();
    const goes = vi.fn();
    renderHook(() => useHotkey(['f'], stays, document.body));
    const other = renderHook(() => useHotkey(['f'], goes, document.body));

    other.unmount();
    pressF();

    expect(goes).not.toHaveBeenCalled();
    expect(stays).toHaveBeenCalledTimes(1);
  });
});

// Every real call site passes a LIST, which reaches hotkeys-js comma-joined.
// Unbinding by handler has to cover each key in it or the binding outlives the
// component.
describe('when a hotkey binds several keys at once', () => {
  it('should release all of them on unmount', () => {
    const onKey = vi.fn();
    const { unmount } = renderHook(() => useHotkey(['f', 'g'], onKey, document.body));

    unmount();
    pressF();
    fireEvent.keyDown(document.body, { key: 'g', keyCode: 71 });

    expect(onKey).not.toHaveBeenCalled();
  });
});
