import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { Entity } from '@dcl/ecs';

import type { InteractionStateKey } from '../../components/UIDesigner/code/interaction-convention';
import type { DeviceKind } from '../../components/UIDesigner/safe-areas';
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
  // Multi-selection in click order; the property-panel / hotkey target is the
  // LAST entry (getSelectedNode). Single-select is the length-1 case.
  selectedNodes: Entity[];
  expanded: Record<number, boolean>;
  // Editor-only canvas affordances (never written to code): a hidden node
  // isn't rendered on the canvas; a locked node can't be selected/dragged/
  // resized there. Keyed by the synthetic node id (session-only).
  hidden: Record<number, boolean>;
  locked: Record<number, boolean>;
  // Editor-only: nodes whose width/height are constrained to their aspect ratio
  // when resized (panel edits + canvas handles). Keyed by synthetic node id.
  aspectLocked: Record<number, boolean>;
  collapsedGroups: Record<string, boolean>;
  // Editor-only: which interaction layer the properties panel edits (and the
  // canvas previews). Global rather than per-node — it is a view mode, and it
  // resets to 'base' on selection change so you never land in a hidden state.
  interactionLayer: InteractionStateKey;
  // The device the canvas previews AND edits: a platform-variant node renders and
  // routes edits to the branch matching this (see code/platform-convention.ts).
  platform: DeviceKind;
}

export const initialState: UIDesignerState = {
  selectedNodes: [],
  expanded: {},
  hidden: {},
  locked: {},
  aspectLocked: {},
  collapsedGroups: loadCollapsedGroups(),
  interactionLayer: 'base',
  platform: 'desktop',
};

export const uiDesignerSlice = createSlice({
  name: 'uiDesigner',
  initialState,
  reducers: {
    // Single-select (replaces the whole selection). null clears it.
    selectNode: (state, { payload }: PayloadAction<{ node: Entity | null }>) => {
      state.selectedNodes = payload.node === null ? [] : [payload.node];
      state.interactionLayer = 'base';
    },
    // Ctrl/Cmd-click: add the node to the selection, or drop it if present.
    toggleNodeSelection: (state, { payload }: PayloadAction<{ node: Entity }>) => {
      const idx = state.selectedNodes.indexOf(payload.node);
      if (idx >= 0) state.selectedNodes.splice(idx, 1);
      else state.selectedNodes.push(payload.node);
      state.interactionLayer = 'base';
    },
    // Replace the selection wholesale (shift-range, post-reparse re-anchor).
    selectNodes: (state, { payload }: PayloadAction<{ nodes: Entity[] }>) => {
      state.selectedNodes = payload.nodes;
      state.interactionLayer = 'base';
    },
    setInteractionLayer: (state, { payload }: PayloadAction<{ layer: InteractionStateKey }>) => {
      state.interactionLayer = payload.layer;
    },
    setPlatform: (state, { payload }: PayloadAction<{ platform: DeviceKind }>) => {
      state.platform = payload.platform;
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
    setAspectLocked: (state, { payload }: PayloadAction<{ entity: Entity; locked: boolean }>) => {
      const id = payload.entity as unknown as number;
      if (payload.locked) state.aspectLocked[id] = true;
      else delete state.aspectLocked[id];
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
      state.aspectLocked = remap(state.aspectLocked);
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
      state.aspectLocked = {};
    },
  },
});

export const {
  selectNode,
  toggleNodeSelection,
  selectNodes,
  setExpanded,
  setNodeHidden,
  setNodeLocked,
  setAspectLocked,
  remapNodeIds,
  setGroupCollapsed,
  resetExpanded,
  resetNodeState,
  setInteractionLayer,
  setPlatform,
} = uiDesignerSlice.actions;

export const getSelectedNodes = (state: RootState) => state.uiDesigner.selectedNodes;
// The single-node consumers' view of the selection: its most recent entry.
export const getSelectedNode = (state: RootState) => state.uiDesigner.selectedNodes.at(-1) ?? null;
export const getExpanded = (state: RootState) => state.uiDesigner.expanded;
export const getHiddenNodes = (state: RootState) => state.uiDesigner.hidden;
export const getLockedNodes = (state: RootState) => state.uiDesigner.locked;
export const getAspectLockedNodes = (state: RootState) => state.uiDesigner.aspectLocked;
export const getCollapsedGroups = (state: RootState) => state.uiDesigner.collapsedGroups;
export const getInteractionLayer = (state: RootState) => state.uiDesigner.interactionLayer;
export const getPlatform = (state: RootState) => state.uiDesigner.platform;

export default uiDesignerSlice.reducer;
