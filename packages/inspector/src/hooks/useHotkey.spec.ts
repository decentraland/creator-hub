import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, cleanup, fireEvent } from '@testing-library/react';

import { ACTIVATABLE_CONTROLS, RESET_CAMERA, UNDO, useHotkey } from './useHotkey';

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
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

describe('when the reset-camera hotkey ignores activatable controls', () => {
  const press = (target: Element, init: KeyboardEventInit & { keyCode: number }) => {
    const notPrevented = fireEvent.keyDown(target, init);
    fireEvent.keyUp(target, init);
    return notPrevented;
  };
  const pressSpace = (target: Element) => press(target, { key: ' ', keyCode: 32 });
  const mount = (html: string) => {
    document.body.insertAdjacentHTML('beforeend', html);
    return document.body.lastElementChild!;
  };

  describe.each([
    ['a button', '<button type="button">Video Screens</button>'],
    ['a checkbox', '<input type="checkbox" aria-label="Enable Video Screens" />'],
    ['a role=button element', '<div role="button" tabindex="0">Open</div>'],
    ['a role=checkbox element', '<div role="checkbox" tabindex="0" aria-checked="false"></div>'],
    ['a radio', '<input type="radio" name="layout" aria-label="Main" />'],
    ['a role=radio element', '<div role="radio" tabindex="0" aria-checked="false"></div>'],
  ])('and Space is pressed on %s', (_, html) => {
    it('should neither reset the camera nor cancel the key', () => {
      const onReset = vi.fn();
      renderHook(() =>
        useHotkey([RESET_CAMERA], onReset, document.body, { ignoreTargets: ACTIVATABLE_CONTROLS }),
      );

      const notPrevented = pressSpace(mount(html));

      expect(onReset).not.toHaveBeenCalled();
      expect(notPrevented).toBe(true);
    });
  });

  describe('and Space is pressed on the body', () => {
    it('should reset the camera', () => {
      const onReset = vi.fn();
      renderHook(() =>
        useHotkey([RESET_CAMERA], onReset, document.body, { ignoreTargets: ACTIVATABLE_CONTROLS }),
      );

      pressSpace(document.body);

      expect(onReset).toHaveBeenCalledTimes(1);
    });
  });

  describe('and another hotkey is pressed on a button', () => {
    it('should still run that hotkey', () => {
      const onUndo = vi.fn();
      renderHook(() =>
        useHotkey([RESET_CAMERA], vi.fn(), document.body, { ignoreTargets: ACTIVATABLE_CONTROLS }),
      );
      renderHook(() => useHotkey([UNDO], onUndo, document.body));

      const button = mount('<button type="button">Video Screens</button>');
      fireEvent.keyDown(button, { key: 'Control', keyCode: 17, ctrlKey: true });
      press(button, { key: 'z', keyCode: 90, ctrlKey: true });
      fireEvent.keyUp(button, { key: 'Control', keyCode: 17 });

      expect(onUndo).toHaveBeenCalledTimes(1);
    });
  });
});
