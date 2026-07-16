import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { Entity } from '@dcl/ecs';

import type { RootState } from '../store';

// Persist the property-panel group collapse state across reloads. There is no
// persistence middleware in this app, so we read/write localStorage directly
// (guarded for non-browser/test environments).
const COLLAPSED_GROUPS_KEY = 'ui-designer:collapsed-groups';

function loadCollapsedGroups(): Record<string, boolean> {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(COLLAPSED_GROUPS_KEY) ?? '{}') as Record<
      string,
      boolean
    >;
  } catch {
    return {};
  }
}

function persistCollapsedGroups(groups: Record<string, boolean>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(groups));
  } catch {
    // ignore quota / disabled-storage errors
  }
}

export interface UIDesignerState {
  selectedRoot: Entity | null;
  selectedNode: Entity | null;
  expanded: Record<number, boolean>;
  // Editor-only canvas affordances (never written to code): a hidden node
  // isn't rendered on the canvas; a locked node can't be selected/dragged/
  // resized there. Keyed by the synthetic node id (session-only).
  hidden: Record<number, boolean>;
  locked: Record<number, boolean>;
  collapsedGroups: Record<string, boolean>;
}

export const initialState: UIDesignerState = {
  selectedRoot: null,
  selectedNode: null,
  expanded: {},
  hidden: {},
  locked: {},
  collapsedGroups: loadCollapsedGroups(),
};

export const uiDesignerSlice = createSlice({
  name: 'uiDesigner',
  initialState,
  reducers: {
    selectRoot: (state, { payload }: PayloadAction<{ root: Entity | null }>) => {
      state.selectedRoot = payload.root;
      state.selectedNode = payload.root;
      state.expanded = {};
    },
    selectNode: (state, { payload }: PayloadAction<{ node: Entity | null }>) => {
      state.selectedNode = payload.node;
    },
    setExpanded: (state, { payload }: PayloadAction<{ entity: Entity; expanded: boolean }>) => {
      state.expanded[payload.entity as unknown as number] = payload.expanded;
    },
    setNodeHidden: (state, { payload }: PayloadAction<{ entity: Entity; hidden: boolean }>) => {
      const id = payload.entity as unknown as number;
      if (payload.hidden) state.hidden[id] = true;
      else delete state.hidden[id];
    },
    setNodeLocked: (state, { payload }: PayloadAction<{ entity: Entity; locked: boolean }>) => {
      const id = payload.entity as unknown as number;
      if (payload.locked) state.locked[id] = true;
      else delete state.locked[id];
    },
    // Synthetic node ids are positional per parse — after a reparse the code
    // store re-anchors every id-keyed map through an oldId→newId mapping
    // (unmapped ids are dropped: the node no longer exists).
    remapNodeIds: (state, { payload }: PayloadAction<{ mapping: Record<number, number> }>) => {
      const remap = (rec: Record<number, boolean>): Record<number, boolean> => {
        const next: Record<number, boolean> = {};
        for (const [old, v] of Object.entries(rec)) {
          const mapped = payload.mapping[Number(old)];
          if (mapped !== undefined) next[mapped] = v;
        }
        return next;
      };
      state.expanded = remap(state.expanded);
      state.hidden = remap(state.hidden);
      state.locked = remap(state.locked);
    },
    setGroupCollapsed: (
      state,
      { payload }: PayloadAction<{ title: string; collapsed: boolean }>,
    ) => {
      state.collapsedGroups[payload.title] = payload.collapsed;
      persistCollapsedGroups(state.collapsedGroups);
    },
    resetExpanded: state => {
      state.expanded = {};
    },
    // Clear all id-keyed node state — dispatched on active-file switches, where
    // the positional ids of the previous file would collide with the new one's.
    resetNodeState: state => {
      state.expanded = {};
      state.hidden = {};
      state.locked = {};
    },
  },
});

export const {
  selectRoot,
  selectNode,
  setExpanded,
  setNodeHidden,
  setNodeLocked,
  remapNodeIds,
  setGroupCollapsed,
  resetExpanded,
  resetNodeState,
} = uiDesignerSlice.actions;

export const getSelectedRoot = (state: RootState) => state.uiDesigner.selectedRoot;
export const getSelectedNode = (state: RootState) => state.uiDesigner.selectedNode;
export const getExpanded = (state: RootState) => state.uiDesigner.expanded;
export const getHiddenNodes = (state: RootState) => state.uiDesigner.hidden;
export const getLockedNodes = (state: RootState) => state.uiDesigner.locked;
export const getCollapsedGroups = (state: RootState) => state.uiDesigner.collapsedGroups;

export default uiDesignerSlice.reducer;
