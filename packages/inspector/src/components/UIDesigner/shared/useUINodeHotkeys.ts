import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { Entity } from '@dcl/ecs';

import { useAppSelector } from '../../../redux/hooks';
import { getSelectedNode } from '../../../redux/ui-designer';
import { isAssetExplorerActive } from '../../../redux/ui';
import { useUINodeActions } from './useUINodeActions';

/** UI-Designer keyboard shortcuts (copy/paste/duplicate/delete), scoped to the panel. */
export function useUINodeHotkeys(containerRef: RefObject<HTMLElement>): void {
  const selectedNode = useAppSelector(getSelectedNode);
  const assetExplorerActive = useAppSelector(isAssetExplorerActive);
  const { remove, duplicate } = useUINodeActions();
  const copiedRef = useRef<Entity | null>(null);

  const state = useRef({ selectedNode, remove, duplicate, assetExplorerActive });
  state.current = { selectedNode, remove, duplicate, assetExplorerActive };

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
      const container = containerRef.current;
      if (!container || container.offsetParent === null) return;
      if (isEditable(e.target)) return;

      const { selectedNode, remove, duplicate, assetExplorerActive } = state.current;
      if (assetExplorerActive) return;
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
        void duplicate(source);
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
