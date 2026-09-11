import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SceneBuildEvent } from '../../logic/scene-build-events';
import {
  createBuildReloadBridge,
  isEditorOutput,
  type BuildReloadBridge,
} from './build-reload-bridge';

const COMPOSITE = '/scene/assets/scene/main.composite';
const ENTITY_NAMES = '/scene/assets/scene/entity-names.ts';
const CODE = '/scene/src/index.ts';
const UI_ROOT = '/scene/src/ui/root.tsx';
const QUIET_MS = 300;

describe('isEditorOutput', () => {
  it('should recognise the autosave outputs by any absolute prefix and slash style', () => {
    expect(isEditorOutput(COMPOSITE)).toBe(true);
    expect(isEditorOutput('C:\\scenes\\demo\\assets\\scene\\entity-names.ts')).toBe(true);
    expect(isEditorOutput('assets/scene/main.composite')).toBe(true);
  });

  it('should not claim source files or look-alikes', () => {
    expect(isEditorOutput(CODE)).toBe(false);
    expect(isEditorOutput('/scene/other-assets/scene/main.composite')).toBe(false);
  });
});

describe('createBuildReloadBridge', () => {
  let listener: ((event: SceneBuildEvent) => void) | null;
  let unsubscribe: ReturnType<typeof vi.fn>;
  let reload: ReturnType<typeof vi.fn>;
  let ownWrites: Set<string>;
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
    bridge = createBuildReloadBridge({
      subscribe: cb => {
        listener = cb;
        return unsubscribe;
      },
      isOwnWrite: file => ownWrites.has(file),
      reload,
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
    it('should reload once the bundle has landed and the cycles go quiet', () => {
      cycle(CODE);

      expect(reload).not.toHaveBeenCalled();
      vi.advanceTimersByTime(QUIET_MS);
      expect(reload).toHaveBeenCalledTimes(1);
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
