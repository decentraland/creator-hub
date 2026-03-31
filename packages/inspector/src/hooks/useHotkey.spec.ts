import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock hotkeys-js so we can directly invoke the registered handler
// ---------------------------------------------------------------------------
type HotkeyHandler = (event: KeyboardEvent) => void;

let registeredHandler: HotkeyHandler | null = null;

vi.mock('hotkeys-js', () => {
  const mockHotkeys = vi.fn((_keys: string, _opts: unknown, handler: HotkeyHandler) => {
    registeredHandler = handler;
  }) as any;
  mockHotkeys.unbind = vi.fn();
  mockHotkeys.filter = () => true;
  return { default: mockHotkeys };
});

// Import AFTER vi.mock so the mock is active
import { COPY, COPY_ALT, useHotkey } from './useHotkey';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(target?: Element): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { cancelable: true, bubbles: true });
  if (target !== undefined) {
    Object.defineProperty(event, 'target', { value: target, configurable: true });
  }
  return event;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useHotkey', () => {
  beforeEach(() => {
    registeredHandler = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('when no shouldSkip predicate is provided', () => {
    it('should call the callback and preventDefault when the hotkey fires', () => {
      const callback = vi.fn();
      renderHook(() => useHotkey('ctrl+s', callback, document.body));

      const event = makeEvent();
      registeredHandler!(event);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('when shouldSkip returns false', () => {
    it('should call the callback and preventDefault', () => {
      const callback = vi.fn();
      const shouldSkip = vi.fn().mockReturnValue(false);

      renderHook(() => useHotkey('ctrl+s', callback, document.body, shouldSkip));

      const event = makeEvent(document.body);
      registeredHandler!(event);

      expect(shouldSkip).toHaveBeenCalledWith(event);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('when shouldSkip returns true', () => {
    it('should NOT invoke the callback', () => {
      const callback = vi.fn();
      const shouldSkip = vi.fn().mockReturnValue(true);

      renderHook(() => useHotkey('ctrl+s', callback, document.body, shouldSkip));

      const event = makeEvent();
      registeredHandler!(event);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should NOT call event.preventDefault so native browser copy is preserved', () => {
      const callback = vi.fn();
      const shouldSkip = vi.fn().mockReturnValue(true);

      renderHook(() => useHotkey('ctrl+c', callback, document.body, shouldSkip));

      const event = makeEvent();
      registeredHandler!(event);

      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('COPY hotkey shouldSkip integration — DebugConsole scenario', () => {
    it('should skip entity-copy when event target is inside .DebugConsole-logs', () => {
      const logsDiv = document.createElement('div');
      logsDiv.className = 'DebugConsole-logs';
      document.body.appendChild(logsDiv);

      const span = document.createElement('span');
      logsDiv.appendChild(span);

      const callback = vi.fn();
      const shouldSkip = (e: KeyboardEvent) =>
        !!(e.target as Element | null)?.closest?.('.DebugConsole-logs');

      renderHook(() => useHotkey([COPY, COPY_ALT], callback, document.body, shouldSkip));

      // Simulate keydown originating from inside the console
      const event = makeEvent(span);
      registeredHandler!(event);

      expect(callback).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);

      document.body.removeChild(logsDiv);
    });

    it('should run entity-copy when event target is outside .DebugConsole-logs', () => {
      const callback = vi.fn();
      const shouldSkip = (e: KeyboardEvent) =>
        !!(e.target as Element | null)?.closest?.('.DebugConsole-logs');

      renderHook(() => useHotkey([COPY, COPY_ALT], callback, document.body, shouldSkip));

      // Target is document.body (no .DebugConsole-logs ancestor)
      const event = makeEvent(document.body);
      registeredHandler!(event);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);
    });
  });
});
