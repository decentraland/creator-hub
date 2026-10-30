import { useEffect, useLayoutEffect, useRef } from 'react';
import type { KeyHandler } from 'hotkeys-js';
import hotkeys from 'hotkeys-js';

export const SHIFT = 'shift';
export const CTRL = 'ctrl';
export const ALT = 'alt';
export const COMMAND = 'command';
export const DELETE = 'delete';
export const BACKSPACE = 'backspace';
export const COPY = `${CTRL}+c`;
export const COPY_ALT = `${COMMAND}+c`;
export const CUT = `${CTRL}+x`;
export const CUT_ALT = `${COMMAND}+x`;
export const PASTE = `${CTRL}+v`;
export const PASTE_ALT = `${COMMAND}+v`;
export const UNDO = `${CTRL}+z`;
export const UNDO_ALT = `${COMMAND}+z`;
export const REDO = `${CTRL}+${SHIFT}+z`;
export const REDO_2 = `${CTRL}+y`;
export const REDO_ALT = `${COMMAND}+${SHIFT}+z`;
export const REDO_ALT_2 = `${COMMAND}+y`;
export const ZOOM_IN = '=';
export const ZOOM_IN_ALT = '+';
export const ZOOM_OUT = '-';
export const ZOOM_OUT_ALT = '_';
export const RESET_CAMERA = 'space';
export const SAVE = `${CTRL}+s`;
export const SAVE_ALT = `${COMMAND}+s`;
export const DUPLICATE = `${CTRL}+d`;
export const DUPLICATE_ALT = `${COMMAND}+d`;
export const SELECT_ALL = `${CTRL}+a`;
export const SELECT_ALL_ALT = `${COMMAND}+a`;
export const ESCAPE = 'esc';
export const ARROW_UP = 'up';
export const ARROW_DOWN = 'down';
export const ARROW_LEFT = 'left';
export const ARROW_RIGHT = 'right';
export const EXTEND_UP = `${SHIFT}+up`;
export const EXTEND_DOWN = `${SHIFT}+down`;
export const FOCUS_SELECTED = 'f';
export const TOGGLE_FREE_CAMERA = '`';

/** Controls that Space activates natively. */
export const ACTIVATABLE_CONTROLS =
  'button, input[type="checkbox"], input[type="radio"], [role="button"], [role="checkbox"], [role="radio"]';

interface UseHotkeyOptions {
  /** Skip registration entirely while false (default true). */
  enabled?: boolean;
  /** Selector of key targets the hotkey leaves alone: no callback, no preventDefault. */
  ignoreTargets?: string;
}

/**
 * Hook that listens for key presses and triggers a callback function when the specified keys are pressed.
 *
 * @param keys - An array of strings representing the keys to listen for.
 * @param callback - The callback function to be executed when the specified keys are pressed.
 * @param node - The target DOM node to attach the event listener to. If not provided, the listener will be attached to the entire document.
 * @param options - See {@link UseHotkeyOptions}.
 */
export const useHotkey = (
  keys: string | string[],
  callback: KeyHandler | (() => void),
  node: any = undefined,
  options: UseHotkeyOptions = {},
) => {
  const { enabled = true, ignoreTargets } = options;
  const callbackRef = useRef(callback);
  useLayoutEffect(() => {
    callbackRef.current = callback;
  });

  const formattedKeys = Array.isArray(keys) ? keys.join(',') : keys;

  useEffect(() => {
    const targetDocument = node !== undefined ? node : document;
    if (!targetDocument || !enabled) return;
    const handler: KeyHandler = (event, hotkeysEvent) => {
      if (ignoreTargets && (event.target as Element | null)?.matches?.(ignoreTargets)) return;
      event.preventDefault();
      callbackRef.current(event, hotkeysEvent);
    };
    hotkeys(formattedKeys, { element: targetDocument }, handler);
    return () => {
      hotkeys.unbind(formattedKeys, handler);
    };
  }, [node, formattedKeys, enabled, ignoreTargets]);
};
