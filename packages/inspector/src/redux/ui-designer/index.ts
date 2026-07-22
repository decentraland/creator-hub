import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { Entity } from '@dcl/ecs';

import type { RootState } from '../store';

export type UIDesignerTool = 'move' | 'resize';

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
  collapsedGroups: Record<string, boolean>;
  tool: UIDesignerTool;
}

export const initialState: UIDesignerState = {
  selectedRoot: null,
  selectedNode: null,
  expanded: {},
  collapsedGroups: loadCollapsedGroups(),
  tool: 'move',
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
    setTool: (state, { payload }: PayloadAction<{ tool: UIDesignerTool }>) => {
      state.tool = payload.tool;
    },
  },
});

export const { selectRoot, selectNode, setExpanded, setGroupCollapsed, resetExpanded, setTool } =
  uiDesignerSlice.actions;

export const getSelectedRoot = (state: RootState) => state.uiDesigner.selectedRoot;
export const getSelectedNode = (state: RootState) => state.uiDesigner.selectedNode;
export const getExpanded = (state: RootState) => state.uiDesigner.expanded;
export const getCollapsedGroups = (state: RootState) => state.uiDesigner.collapsedGroups;
export const getTool = (state: RootState) => state.uiDesigner.tool;

export default uiDesignerSlice.reducer;
