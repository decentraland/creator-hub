import type { RootState } from '../../redux/store';
import { AssetsTab, PanelName, SceneInspectorTab, UIDesignerTool } from '../../redux/ui/types';
import type { Emit, StopTracker } from './types';

export type ReduxTrackerOptions = {
  store: { getState(): RootState; subscribe(listener: () => void): () => void };
  emit: Emit;
};

type Change = { kind: string; text: string };

type Watcher<T> = {
  select: (state: RootState) => T;
  describe: (next: T, prev: T) => Change | Change[] | null;
};

const PANEL_NAMES: Record<PanelName, string> = {
  [PanelName.ENTITIES]: 'Entity tree',
  [PanelName.COMPONENTS]: 'Entity inspector',
  [PanelName.ASSETS]: 'Assets panel',
  [PanelName.TOOLBAR]: 'Toolbar',
  [PanelName.SHORTCUTS]: 'Shortcuts panel',
  [PanelName.METRICS]: 'Scene metrics panel',
  [PanelName.SCENE_INFO]: 'Scene info panel',
  [PanelName.UI_DESIGNER]: 'UI Designer',
};

const ASSETS_TAB_NAMES: Record<AssetsTab, string> = {
  [AssetsTab.FileSystem]: 'Local Assets',
  [AssetsTab.CustomAssets]: 'Custom Items',
  [AssetsTab.AssetsPack]: 'Asset Packs',
  [AssetsTab.DebugConsole]: 'Console',
  [AssetsTab.MobileDebugSession]: 'Mobile Debug',
  [AssetsTab.RenameAsset]: 'Rename asset',
  [AssetsTab.CreateCustomAsset]: 'Create custom item',
};

const SCENE_TAB_NAMES: Record<SceneInspectorTab, string> = {
  [SceneInspectorTab.DETAILS]: 'Details',
  [SceneInspectorTab.LAYOUT]: 'Layout',
  [SceneInspectorTab.SETTINGS]: 'Settings',
};

const TOOL_NAMES: Record<UIDesignerTool, string> = {
  [UIDesignerTool.FREE]: 'Free',
  [UIDesignerTool.MOVE]: 'Move',
  [UIDesignerTool.RESIZE]: 'Resize',
};

const onOff = (on: boolean) => (on ? 'on' : 'off');

function watch<T>(watcher: Watcher<T>): Watcher<unknown> {
  return watcher as Watcher<unknown>;
}

// What the user changed in the inspector's own UI state. Each watcher compares one
// selector's result by reference, so unrelated store updates cost a few `===` checks.
const WATCHERS: Watcher<unknown>[] = [
  watch({
    select: s => s.ui.hiddenPanels,
    describe: (next, prev) => {
      const changes: Change[] = [];
      for (const panel of Object.values(PanelName)) {
        const hidden = !!next[panel];
        if (hidden === !!prev[panel]) continue;
        if (panel === PanelName.UI_DESIGNER) {
          changes.push({
            kind: 'mode',
            text: hidden
              ? 'Switched back to the 3D scene editor'
              : 'Switched to the UI Designer (2D)',
          });
        } else {
          changes.push({
            kind: 'panel',
            text: `${hidden ? 'Hid' : 'Showed'} the ${PANEL_NAMES[panel]}`,
          });
        }
      }
      return changes;
    },
  }),
  watch({
    select: s => s.ui.selectedAssetsTab,
    describe: next => ({
      kind: 'panel',
      text: `Opened the ${ASSETS_TAB_NAMES[next] ?? next} tab of the Assets panel`,
    }),
  }),
  watch({
    select: s => s.ui.selectedSceneInspectorTab,
    describe: next => ({
      kind: 'panel',
      text: `Opened the ${SCENE_TAB_NAMES[next] ?? next} tab of the Scene settings`,
    }),
  }),
  watch({
    select: s => s.ui.disableGizmos,
    describe: next => ({ kind: 'mode', text: `Turned ${onOff(!next)} the gizmos` }),
  }),
  watch({
    select: s => s.ui.disableGroundGrid,
    describe: next => ({ kind: 'mode', text: `Turned ${onOff(!next)} the ground grid` }),
  }),
  watch({
    select: s => s.ui.debugConsoleEnabled,
    describe: next => ({ kind: 'panel', text: `${next ? 'Opened' : 'Closed'} the debug console` }),
  }),
  watch({
    select: s => s.ui.debugConsoleDetached,
    describe: next => ({
      kind: 'panel',
      text: next
        ? 'Popped the debug console out into its own window'
        : 'Docked the debug console back',
    }),
  }),
  watch({
    select: s => s.ui.uiDesignerTool,
    describe: next => ({
      kind: 'mode',
      text: `Switched the UI Designer tool to ${TOOL_NAMES[next] ?? next}`,
    }),
  }),
  watch({
    select: s => s.ui.uiDesignerSnapEnabled,
    describe: next => ({ kind: 'mode', text: `Turned ${onOff(next)} snapping in the UI Designer` }),
  }),
  watch({
    select: s => s.uiDesigner.platform,
    describe: next => ({ kind: 'mode', text: `Switched the UI Designer preview to ${next}` }),
  }),
  watch({
    select: s => s.app.preferences?.freeCameraInvertRotation,
    describe: (next, prev) =>
      prev === undefined || next === undefined
        ? null
        : { kind: 'setting', text: `Turned ${onOff(next)} inverted camera rotation` },
  }),
  watch({
    select: s => s.app.preferences?.autosaveEnabled,
    describe: (next, prev) =>
      prev === undefined || next === undefined
        ? null
        : { kind: 'setting', text: `Turned ${onOff(next)} autosave` },
  }),
];

/** Records panel, tab, mode and preference changes made in the inspector's own UI. */
export function trackRedux({ store, emit }: ReduxTrackerOptions): StopTracker {
  let previous = WATCHERS.map(watcher => watcher.select(store.getState()));

  const unsubscribe = store.subscribe(() => {
    const state = store.getState();
    const next = WATCHERS.map(watcher => watcher.select(state));
    WATCHERS.forEach((watcher, i) => {
      if (next[i] === previous[i]) return;
      const change = watcher.describe(next[i], previous[i]);
      const changes = Array.isArray(change) ? change : change ? [change] : [];
      changes.forEach(c => emit(c));
    });
    previous = next;
  });

  return unsubscribe;
}
