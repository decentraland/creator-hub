import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { navigate, type NavItem } from './navigation';

type SelectMode = 'single' | 'extend';

export type TreeItemActions = {
  select: (mode: SelectMode) => void;
  setOpen?: (open: boolean) => void;
};

type TreeContextValue = {
  tabStopId: string | null;
  register: (id: string, actions: TreeItemActions) => () => void;
};

const TreeContext = createContext<TreeContextValue | null>(null);

const ROW_SELECTOR = '[role="treeitem"]';

const visibleRows = (root: HTMLElement | null) =>
  Array.from(root?.querySelectorAll<HTMLElement>(ROW_SELECTOR) ?? []).filter(
    el => el.getClientRects().length > 0,
  );

const toNavItem = (el: HTMLElement): NavItem => {
  const expanded = el.getAttribute('aria-expanded');
  return {
    id: el.dataset.treeId ?? '',
    level: Number(el.getAttribute('aria-level')),
    expanded: expanded === null ? undefined : expanded === 'true',
  };
};

/** Registers a tree row with its `TreeRoot` and returns the row's roving `tabIndex`. */
export function useTreeItem(id: string, actions: TreeItemActions): { tabIndex: 0 | -1 } {
  const tree = useContext(TreeContext);
  const register = tree?.register;
  useLayoutEffect(() => register?.(id, actions));
  return { tabIndex: tree?.tabStopId === id ? 0 : -1 };
}

/** The WAI-ARIA tree container: one tab stop, arrow-key navigation and Enter / Shift + arrow selection. */
export function TreeRoot({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const items = useRef(new Map<string, TreeItemActions>());
  const activeId = useRef<string | null>(null);
  const [tabStopId, setTabStopId] = useState<string | null>(null);

  const register = useCallback((id: string, actions: TreeItemActions) => {
    items.current.set(id, actions);
    return () => {
      if (items.current.get(id) === actions) items.current.delete(id);
    };
  }, []);

  const syncTabStop = useCallback(() => {
    const rows = visibleRows(ref.current);
    const stop =
      rows.find(el => el.dataset.treeId === activeId.current) ??
      rows.find(el => el.getAttribute('aria-selected') === 'true') ??
      rows[0];
    setTabStopId(stop?.dataset.treeId ?? null);
  }, []);

  useLayoutEffect(() => {
    syncTabStop();
    if (!ref.current) return;
    const observer = new MutationObserver(syncTabStop);
    observer.observe(ref.current, {
      subtree: true,
      childList: true,
      attributeFilter: ['aria-selected', 'aria-expanded', 'class'],
    });
    return () => observer.disconnect();
  }, [syncTabStop]);

  const handleFocus = useCallback((event: React.FocusEvent) => {
    const id = (event.target as HTMLElement).closest<HTMLElement>(ROW_SELECTOR)?.dataset.treeId;
    if (!id) return;
    activeId.current = id;
    setTabStopId(id);
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target.getAttribute('role') !== 'treeitem') return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const rows = visibleRows(ref.current);
    const result = navigate(
      rows.map(toNavItem),
      target.dataset.treeId ?? '',
      event.key,
      event.shiftKey,
    );
    if (!result) return;
    event.preventDefault();
    event.stopPropagation();
    const actions = items.current.get(result.id);
    const focus = () => rows.find(el => el.dataset.treeId === result.id)?.focus();
    switch (result.kind) {
      case 'focus':
        return focus();
      case 'extend':
        focus();
        return actions?.select('extend');
      case 'select':
        return actions?.select('single');
      case 'setOpen':
        return actions?.setOpen?.(result.open);
    }
  }, []);

  const value = useMemo(() => ({ tabStopId, register }), [tabStopId, register]);

  return (
    <TreeContext.Provider value={value}>
      <div
        ref={ref}
        className="TreeRoot"
        role="tree"
        aria-label={label}
        aria-multiselectable="true"
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
      >
        {children}
      </div>
    </TreeContext.Provider>
  );
}
