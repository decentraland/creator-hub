import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { Entity } from '@dcl/ecs';

import { useSdk } from '../../hooks/sdk/useSdk';
import { useAppSelector } from '../../redux/hooks';
import { getSelectedNode } from '../../redux/ui-designer';
import { useUINodeActions } from './useUINodeActions';

// UI-Designer keyboard shortcuts, attached to `document` but scoped by guards
// (editable-target, visible panel, selected node) so they don't interfere with
// typing or the 3D editor's hotkeys. Deliberately NOT built on useHotkey — that
// hook's cleanup unbinds keys GLOBALLY and would clobber the Renderer's
// Ctrl+C/V/D/Delete. A UI-node "clipboard" is just the last-copied entity id
// (in a ref); paste clones it via duplicateUINode (sibling of the original).
export function useUINodeHotkeys(containerRef: RefObject<HTMLElement>): void {
  const sdk = useSdk();
  const selectedNode = useAppSelector(getSelectedNode);
  const { remove, duplicate } = useUINodeActions();
  const copiedRef = useRef<Entity | null>(null);

  // Keep the latest values addressable from the stable listener.
  const state = useRef({ sdk, selectedNode, remove, duplicate });
  state.current = { sdk, selectedNode, remove, duplicate };

  useEffect(() => {
    const isEditable = (el: EventTarget | null): boolean => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      return (
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable === true
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Only when the UI Designer is actually on screen.
      const container = containerRef.current;
      if (!container || container.offsetParent === null) return;
      if (isEditable(e.target)) return;

      const { sdk, selectedNode, remove, duplicate } = state.current;
      if (!sdk) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === 'c') {
        if (selectedNode === null) return;
        copiedRef.current = selectedNode as Entity;
        e.preventDefault();
        return;
      }
      if (mod && key === 'v') {
        const source = copiedRef.current;
        if (source === null) return;
        e.preventDefault();
        void duplicate(source); // clone the copied node (sibling of original), selects it
        return;
      }
      if (mod && key === 'd') {
        if (selectedNode === null) return;
        e.preventDefault();
        void duplicate(selectedNode as Entity);
        return;
      }
      if ((key === 'delete' || key === 'backspace') && selectedNode !== null) {
        e.preventDefault();
        remove(selectedNode as Entity);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [containerRef]);
}

export default useUINodeHotkeys;
