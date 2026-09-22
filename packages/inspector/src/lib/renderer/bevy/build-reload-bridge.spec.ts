import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SceneBuildEvent } from '../../logic/scene-build-events';
import {
  createBuildReloadBridge,
  isEditorOutput,
  type BuildReloadBridge,
} from './build-reload-bridge';

const COMPOSITE = 'assets/scene/main.composite';
const ENTITY_NAMES = 'assets/scene/entity-names.ts';
const CODE = 'src/index.ts';
const UI_ROOT = 'src/ui/root.tsx';
const QUIET_MS = 300;

describe('isEditorOutput', () => {
  it('should recognise the autosave outputs in any slash style', () => {
    expect(isEditorOutput(COMPOSITE)).toBe(true);
    expect(isEditorOutput('assets\\scene\\entity-names.ts')).toBe(true);
    expect(isEditorOutput('./assets/scene/main.composite')).toBe(true);
  });

  it('should not claim source files or nested look-alikes', () => {
    expect(isEditorOutput(CODE)).toBe(false);
    expect(isEditorOutput('vendor/assets/scene/main.composite')).toBe(false);
  });
});

describe('createBuildReloadBridge', () => {
  let listener: ((event: SceneBuildEvent) => void) | null;
  let unsubscribe: ReturnType<typeof vi.fn>;
  let reload: ReturnType<typeof vi.fn>;
  let ownWrites: Set<string>;
  let running: boolean;
  let bridge: BuildReloadBridge;

  const emit = (event: SceneBuildEvent) => listener?.(event);
  const cycle = (...files: string[]) => {
    for (const file of files) emit({ kind: 'rebuild', file });
    emit({ kind: 'bundle-saved' });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    listener = null;
    unsubscribe = vi.fn();
    reload = vi.fn();
    ownWrites = new Set();
    running = true;
    bridge = createBuildReloadBridge({
      subscribe: cb => {
        listener = cb;
        return unsubscribe;
      },
      isOwnWrite: file => ownWrites.has(file),
      reload,
      isRunning: () => running,
      quietMs: QUIET_MS,
    });
  });

  afterEach(() => {
    bridge.disconnect();
    vi.useRealTimers();
  });

  describe('when a rebuild was triggered only by the editor’s own autosave', () => {
    it('should not reload', () => {
      cycle(COMPOSITE, ENTITY_NAMES);
      vi.advanceTimersByTime(QUIET_MS * 10);

      expect(reload).not.toHaveBeenCalled();
    });
  });

  describe('when a rebuild was triggered by a source file', () => {
    it('should reload once the bundle has landed and the cycles go quiet, naming the file', () => {
      cycle(CODE);

      expect(reload).not.toHaveBeenCalled();
      vi.advanceTimersByTime(QUIET_MS);
      expect(reload).toHaveBeenCalledTimes(1);
      expect(reload).toHaveBeenCalledWith(`source changed: ${CODE}`);
    });

    it('should reload even when an autosave shares the cycle', () => {
      cycle(COMPOSITE, CODE);
      vi.advanceTimersByTime(QUIET_MS);

      expect(reload).toHaveBeenCalledTimes(1);
    });

    it('should wait for the next bundle when a new cycle starts before the reload fires', () => {
      cycle(CODE);
      vi.advanceTimersByTime(QUIET_MS - 1);
      cycle(COMPOSITE);

      vi.advanceTimersByTime(QUIET_MS - 1);
      expect(reload).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(reload).toHaveBeenCalledTimes(1);
    });
  });

  describe('when a rebuild was queued behind the bundle that just landed', () => {
    // The bundler serialises overlapping rebuilds: the second cycle's trigger line is
    // printed while the first is still building, so the first bundle-saved takes it,
    // and the second bundle-saved arrives with no trigger of its own.
    it('should reload again for a Script edit whose bundle was the queued one', () => {
      emit({ kind: 'rebuild', file: COMPOSITE }); // cycle A: a Transform autosave
      bridge.noteScriptEdit();
      emit({ kind: 'rebuild', file: COMPOSITE }); // cycle B: the Script autosave, queued
      emit({ kind: 'bundle-saved' }); // A lands — does not embed B
      vi.advanceTimersByTime(QUIET_MS);
      expect(reload).toHaveBeenCalledTimes(1);

      emit({ kind: 'bundle-saved' }); // B lands, no trigger left for it
      vi.advanceTimersByTime(QUIET_MS);
      expect(reload).toHaveBeenCalledTimes(2);
    });

    it('should coalesce when the queued bundle lands inside the quiet window', () => {
      cycle(CODE);
      vi.advanceTimersByTime(QUIET_MS - 1);
      emit({ kind: 'bundle-saved' });
      vi.advanceTimersByTime(QUIET_MS);

      expect(reload).toHaveBeenCalledTimes(1);
    });

    it('should stay quiet when the previous bundle decided nothing', () => {
      cycle(COMPOSITE);
      emit({ kind: 'bundle-saved' });
      vi.advanceTimersByTime(QUIET_MS * 10);

      expect(reload).not.toHaveBeenCalled();
    });

    it('should leave a deferred reload to Play, which loads the newest bundle anyway', () => {
      running = false;
      bridge.noteScriptEdit();
      cycle(COMPOSITE);
      emit({ kind: 'bundle-saved' });
      vi.advanceTimersByTime(QUIET_MS * 10);

      expect(reload).not.toHaveBeenCalled();
      expect(bridge.takeDeferredReload()).toBe(true);
      expect(bridge.takeDeferredReload()).toBe(false);
    });
  });

  describe('when the inspector itself wrote the source file', () => {
    it('should treat the rebuild like an autosave and not reload', () => {
      ownWrites.add(UI_ROOT);
      cycle(UI_ROOT);
      vi.advanceTimersByTime(QUIET_MS * 10);

      expect(reload).not.toHaveBeenCalled();
    });
  });

  describe('when a Script component was edited', () => {
    it('should reload on the bundle that embeds it, although only autosave files triggered it', () => {
      bridge.noteScriptEdit();
      cycle(COMPOSITE);
      vi.advanceTimersByTime(QUIET_MS);

      expect(reload).toHaveBeenCalledTimes(1);
      expect(reload).toHaveBeenCalledWith('Script component edited');
    });

    it('should reload just once for the edit', () => {
      bridge.noteScriptEdit();
      cycle(COMPOSITE);
      vi.advanceTimersByTime(QUIET_MS);
      cycle(COMPOSITE);
      vi.advanceTimersByTime(QUIET_MS);

      expect(reload).toHaveBeenCalledTimes(1);
    });
  });

  describe('when a Script component was edited while the scene is frozen', () => {
    beforeEach(() => {
      running = false;
      bridge.noteScriptEdit();
      cycle(COMPOSITE);
      vi.advanceTimersByTime(QUIET_MS * 10);
    });

    it('should not reload, and hand the reload to Play exactly once', () => {
      expect(reload).not.toHaveBeenCalled();
      expect(bridge.takeDeferredReload()).toBe(true);
      expect(bridge.takeDeferredReload()).toBe(false);
    });

    it('should let a later code change reload immediately and cover the deferred one', () => {
      cycle(CODE);
      vi.advanceTimersByTime(QUIET_MS);

      expect(reload).toHaveBeenCalledTimes(1);
      expect(bridge.takeDeferredReload()).toBe(false);
    });
  });

  describe('when a source file changes while the scene is frozen', () => {
    it('should still reload immediately', () => {
      running = false;
      cycle(CODE);
      vi.advanceTimersByTime(QUIET_MS);

      expect(reload).toHaveBeenCalledTimes(1);
      expect(bridge.takeDeferredReload()).toBe(false);
    });
  });

  describe('when nothing is pending', () => {
    it('should report no deferred reload', () => {
      expect(bridge.takeDeferredReload()).toBe(false);
    });
  });

  describe('when the initial build finishes with no trigger', () => {
    it('should not reload', () => {
      emit({ kind: 'bundle-saved' });
      vi.advanceTimersByTime(QUIET_MS * 10);

      expect(reload).not.toHaveBeenCalled();
    });
  });

  describe('when disconnected', () => {
    it('should unsubscribe and cancel a pending reload', () => {
      cycle(CODE);
      bridge.disconnect();
      vi.advanceTimersByTime(QUIET_MS * 10);

      expect(unsubscribe).toHaveBeenCalled();
      expect(reload).not.toHaveBeenCalled();
    });
  });
});
