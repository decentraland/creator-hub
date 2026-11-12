import type { Entity } from '@dcl/ecs';

import type { RootState } from '../../redux/store';
import { initialState as uiInitialState } from '../../redux/ui';
import { PanelName } from '../../redux/ui/types';
import { createInspectorEngine } from '../sdk/inspector-engine';
import { createSessionRecorder, type SessionRecorder } from './session-recorder';
import type { RecordedEvent } from './types';

function createFakeStore() {
  let state = {
    ui: uiInitialState,
    uiDesigner: { platform: 'desktop' },
    app: { preferences: undefined },
  } as unknown as RootState;
  const listeners = new Set<() => void>();
  const unsubscribe = vi.fn();
  return {
    unsubscribe,
    store: {
      getState: () => state,
      subscribe: vi.fn((listener: () => void) => {
        listeners.add(listener);
        return () => {
          unsubscribe();
          listeners.delete(listener);
        };
      }),
    },
    set(next: Partial<RootState['ui']>) {
      state = { ...state, ui: { ...state.ui, ...next } };
      listeners.forEach(listener => listener());
    },
    listenerCount: () => listeners.size,
  };
}

function createFakeRenderer() {
  const untrack = vi.fn();
  const unwatchGizmos = vi.fn();
  const track = vi.fn(() => untrack);
  return {
    track,
    untrack,
    unwatchGizmos,
    renderer: {
      activity: { track },
      gizmos: { isWorldAligned: () => false, onChange: vi.fn(() => unwatchGizmos) },
    } as never,
  };
}

describe('createSessionRecorder', () => {
  let ctx: ReturnType<typeof createInspectorEngine>;
  let fakeStore: ReturnType<typeof createFakeStore>;
  let fakeRenderer: ReturnType<typeof createFakeRenderer>;
  let recordEvents: ReturnType<typeof vi.fn>;
  let client: { recordEvents: typeof recordEvents } | undefined;
  let recorder: SessionRecorder;
  let root: HTMLElement;
  let barrel: Entity;

  function sent(): RecordedEvent[] {
    return recordEvents.mock.calls.flatMap(([events]) => events as RecordedEvent[]);
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    ctx = createInspectorEngine();
    barrel = ctx.engine.addEntity();
    ctx.components.Name.create(barrel, { value: 'Barrel_3' });
    await ctx.engine.update(1);
    fakeStore = createFakeStore();
    fakeRenderer = createFakeRenderer();
    recordEvents = vi.fn(async () => undefined);
    client = { recordEvents };
    root = document.createElement('div');
    root.innerHTML = '<div class="Toolbar"><button>Play</button></div>';
    document.body.appendChild(root);
    recorder = createSessionRecorder({
      engine: ctx.engine,
      events: ctx.events,
      renderer: fakeRenderer.renderer,
      store: fakeStore.store,
      doc: document,
      getClient: () => client,
      now: () => Date.now(),
    });
  });

  afterEach(async () => {
    await recorder.setEnabled(false);
    root.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('when the host has not switched recording on', () => {
    beforeEach(async () => {
      root.querySelector('button')!.click();
      ctx.components.Selection.create(barrel, { gizmo: 0 });
      await ctx.engine.update(1);
      await vi.advanceTimersByTimeAsync(2_000);
    });

    it('should capture nothing', () => {
      expect(recordEvents).not.toHaveBeenCalled();
      expect(fakeRenderer.track).not.toHaveBeenCalled();
      expect(fakeStore.store.subscribe).not.toHaveBeenCalled();
    });
  });

  describe('when the inspector runs standalone, without a host client', () => {
    beforeEach(async () => {
      client = undefined;
      await recorder.setEnabled(true);
    });

    it('should stay a no-op', () => {
      expect(recorder.isRecording()).toBe(false);
      expect(fakeStore.store.subscribe).not.toHaveBeenCalled();
    });
  });

  describe('when recording', () => {
    beforeEach(async () => {
      await recorder.setEnabled(true);
      root.querySelector('button')!.click();
      ctx.components.Selection.create(barrel, { gizmo: 0 });
      await ctx.engine.update(1);
      fakeStore.set({ hiddenPanels: { ...uiInitialState.hiddenPanels, [PanelName.ASSETS]: true } });
    });

    it('should stream what happened in batches every 500 ms', async () => {
      expect(recordEvents).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(500);
      expect(recordEvents).toHaveBeenCalledTimes(1);
      expect(sent().map(e => [e.kind, e.text])).toEqual([
        ['click', 'Clicked "Play" in the Toolbar'],
        ['panel', 'Hid the Assets panel'],
        ['select', `Selected Barrel_3 (#${barrel})`],
      ]);
    });

    describe('and the host switches it off', () => {
      beforeEach(async () => {
        ctx.components.Name.createOrReplace(barrel, { value: 'Box' });
        await ctx.engine.update(1);
        await recorder.setEnabled(false);
      });

      it('should have flushed everything, including changes still coalescing, before resolving', () => {
        expect(sent().map(e => e.text)).toContain(`Renamed "Barrel_3" to "Box" (#${barrel})`);
        expect(recorder.isRecording()).toBe(false);
      });

      it('should detach every listener, observer, subscription and timer', async () => {
        expect(fakeRenderer.untrack).toHaveBeenCalledTimes(1);
        expect(fakeRenderer.unwatchGizmos).toHaveBeenCalledTimes(1);
        expect(fakeStore.listenerCount()).toBe(0);
        expect(vi.getTimerCount()).toBe(0);

        recordEvents.mockClear();
        root.querySelector('button')!.click();
        ctx.components.Name.createOrReplace(barrel, { value: 'Crate' });
        await ctx.engine.update(1);
        fakeStore.set({ disableGizmos: true });
        await vi.advanceTimersByTimeAsync(5_000);
        expect(recordEvents).not.toHaveBeenCalled();
      });
    });
  });

  describe('when recording starts and stops', () => {
    let added: number;
    let removed: number;
    let disconnect: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
      const add = vi.spyOn(document, 'addEventListener');
      const remove = vi.spyOn(document, 'removeEventListener');
      const onChange = vi.spyOn(ctx.events, 'on');
      const offChange = vi.spyOn(ctx.events, 'off');
      disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
      await recorder.setEnabled(true);
      added = add.mock.calls.length;
      await recorder.setEnabled(false);
      removed = remove.mock.calls.length;
      expect(onChange.mock.calls.filter(([type]) => type === 'change')).toHaveLength(1);
      expect(offChange.mock.calls.filter(([type]) => type === 'change')).toHaveLength(1);
    });

    it('should remove exactly the DOM listeners it added and disconnect its observer', () => {
      expect(added).toBeGreaterThan(0);
      expect(removed).toBe(added);
      expect(disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the SDK context is disposed while recording', () => {
    beforeEach(async () => {
      await recorder.setEnabled(true);
      ctx.dispose();
      await vi.advanceTimersByTimeAsync(0);
    });

    it('should stop recording', () => {
      expect(recorder.isRecording()).toBe(false);
      expect(fakeRenderer.untrack).toHaveBeenCalledTimes(1);
    });
  });
});
