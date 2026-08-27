import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { Entity } from '@dcl/ecs';

import type { InteractionStateKey } from '../../components/UIDesigner/code/interaction-convention';
import type { DeviceKind, ScreenSize } from '../../components/UIDesigner/shared/safe-areas';
import { DEFAULT_SCREENS } from '../../components/UIDesigner/shared/safe-areas';
import type { RootState } from '../store';

const COLLAPSED_GROUPS_KEY = 'ui-designer:collapsed-groups';
const SCREENS_KEY = 'ui-designer:screens';

function loadPersisted<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function persist(key: string, value: unknown): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

export interface UIDesignerState {
  selectedNodes: Entity[];
  expanded: Record<number, boolean>;
  hidden: Record<number, boolean>;
  locked: Record<number, boolean>;
  aspectLocked: Record<number, boolean>;
  collapsedGroups: Record<string, boolean>;
  interactionLayer: InteractionStateKey;
  platform: DeviceKind;
  screens: Record<DeviceKind, ScreenSize>;
}

export const initialState: UIDesignerState = {
  selectedNodes: [],
  expanded: {},
  hidden: {},
  locked: {},
  aspectLocked: {},
  collapsedGroups: loadPersisted<Record<string, boolean>>(COLLAPSED_GROUPS_KEY, {}),
  screens: loadPersisted<Record<DeviceKind, ScreenSize>>(SCREENS_KEY, DEFAULT_SCREENS),
  interactionLayer: 'base',
  platform: 'desktop',
};

export const uiDesignerSlice = createSlice({
  name: 'uiDesigner',
  initialState,
  reducers: {
    selectNode: (state, { payload }: PayloadAction<{ node: Entity | null }>) => {
      state.selectedNodes = payload.node === null ? [] : [payload.node];
      state.interactionLayer = 'base';
    },
    toggleNodeSelection: (state, { payload }: PayloadAction<{ node: Entity }>) => {
      const idx = state.selectedNodes.indexOf(payload.node);
      if (idx >= 0) state.selectedNodes.splice(idx, 1);
      else state.selectedNodes.push(payload.node);
      state.interactionLayer = 'base';
    },
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
    setScreen: (state, { payload }: PayloadAction<{ device: DeviceKind; screen: ScreenSize }>) => {
      state.screens[payload.device] = payload.screen;
      persist(SCREENS_KEY, state.screens);
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
      persist(COLLAPSED_GROUPS_KEY, state.collapsedGroups);
    },
    resetExpanded: state => {
      state.expanded = {};
    },
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
  setScreen,
} = uiDesignerSlice.actions;

export const getSelectedNodes = (state: RootState) => state.uiDesigner.selectedNodes;
export const getSelectedNode = (state: RootState) => state.uiDesigner.selectedNodes.at(-1) ?? null;
export const getExpanded = (state: RootState) => state.uiDesigner.expanded;
export const getHiddenNodes = (state: RootState) => state.uiDesigner.hidden;
export const getLockedNodes = (state: RootState) => state.uiDesigner.locked;
export const getAspectLockedNodes = (state: RootState) => state.uiDesigner.aspectLocked;
export const getCollapsedGroups = (state: RootState) => state.uiDesigner.collapsedGroups;
export const getInteractionLayer = (state: RootState) => state.uiDesigner.interactionLayer;
export const getPlatform = (state: RootState) => state.uiDesigner.platform;
export const getScreens = (state: RootState) => state.uiDesigner.screens;

export default uiDesignerSlice.reducer;
