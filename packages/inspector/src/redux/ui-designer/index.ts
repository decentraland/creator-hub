import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { Entity } from '@dcl/ecs';

import type { RootState } from '../store';

export type UIDesignerTool = 'move' | 'resize';

export interface UIDesignerState {
  selectedRoot: Entity | null;
  selectedNode: Entity | null;
  expanded: Record<number, boolean>;
  tool: UIDesignerTool;
}

export const initialState: UIDesignerState = {
  selectedRoot: null,
  selectedNode: null,
  expanded: {},
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
    resetExpanded: state => {
      state.expanded = {};
    },
    setTool: (state, { payload }: PayloadAction<{ tool: UIDesignerTool }>) => {
      state.tool = payload.tool;
    },
  },
});

export const { selectRoot, selectNode, setExpanded, resetExpanded, setTool } =
  uiDesignerSlice.actions;

export const getSelectedRoot = (state: RootState) => state.uiDesigner.selectedRoot;
export const getSelectedNode = (state: RootState) => state.uiDesigner.selectedNode;
export const getExpanded = (state: RootState) => state.uiDesigner.expanded;
export const getTool = (state: RootState) => state.uiDesigner.tool;

export default uiDesignerSlice.reducer;
