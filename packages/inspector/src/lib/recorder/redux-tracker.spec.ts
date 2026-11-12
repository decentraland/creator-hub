import type { RootState } from '../../redux/store';
import { initialState as uiInitialState } from '../../redux/ui';
import { AssetsTab, PanelName } from '../../redux/ui/types';
import { trackRedux } from './redux-tracker';
import type { RecordedEventInput, StopTracker } from './types';

describe('trackRedux', () => {
  let state: RootState;
  let listener: (() => void) | null;
  let emitted: RecordedEventInput[];
  let stop: StopTracker;

  function update(ui: Partial<RootState['ui']>, rest: Partial<RootState> = {}) {
    state = { ...state, ...rest, ui: { ...state.ui, ...ui } };
    listener?.();
  }

  beforeEach(() => {
    state = {
      ui: uiInitialState,
      uiDesigner: { platform: 'desktop' },
      app: { preferences: { freeCameraInvertRotation: false, autosaveEnabled: true } },
    } as unknown as RootState;
    emitted = [];
    stop = trackRedux({
      store: {
        getState: () => state,
        subscribe: cb => {
          listener = cb;
          return () => {
            listener = null;
          };
        },
      },
      emit: event => emitted.push(event),
    });
  });

  afterEach(() => stop());

  describe('when the user switches the assets tab', () => {
    beforeEach(() => update({ selectedAssetsTab: AssetsTab.FileSystem }));

    it('should name the tab', () => {
      expect(emitted).toEqual([
        { kind: 'panel', text: 'Opened the Local Assets tab of the Assets panel' },
      ]);
    });
  });

  describe('when the user opens the UI Designer', () => {
    beforeEach(() =>
      update({ hiddenPanels: { ...uiInitialState.hiddenPanels, [PanelName.UI_DESIGNER]: false } }),
    );

    it('should record it as a mode change', () => {
      expect(emitted).toEqual([{ kind: 'mode', text: 'Switched to the UI Designer (2D)' }]);
    });
  });

  describe('when the user turns off autosave', () => {
    beforeEach(() =>
      update(
        {},
        {
          app: {
            preferences: { freeCameraInvertRotation: false, autosaveEnabled: false },
          } as RootState['app'],
        },
      ),
    );

    it('should record the setting', () => {
      expect(emitted).toEqual([{ kind: 'setting', text: 'Turned off autosave' }]);
    });
  });

  describe('when an unrelated part of the state changes', () => {
    beforeEach(() => update({ assetExplorerActive: true }));

    it('should record nothing', () => {
      expect(emitted).toEqual([]);
    });
  });

  describe('when the tracker stops', () => {
    beforeEach(() => stop());

    it('should unsubscribe from the store', () => {
      expect(listener).toBeNull();
    });
  });
});
