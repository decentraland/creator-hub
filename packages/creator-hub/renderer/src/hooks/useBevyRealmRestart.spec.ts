import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BevyRealmExitEvent } from '/shared/types/ipc';

const { editor } = await import('#preload');
const { useBevyRealmRestart } = await import('./useBevyRealmRestart');

describe('useBevyRealmRestart', () => {
  let emit: (event: BevyRealmExitEvent) => void;
  let unsubscribe: ReturnType<typeof vi.fn>;
  let onRestart: ReturnType<typeof vi.fn>;
  let onGiveUp: ReturnType<typeof vi.fn>;
  let crash: (path: string) => void;

  beforeEach(() => {
    unsubscribe = vi.fn();
    vi.mocked(editor.onBevyRealmExit).mockImplementation(callback => {
      emit = callback;
      return unsubscribe;
    });
    onRestart = vi.fn();
    onGiveUp = vi.fn();
    crash = path => emit({ path, message: 'exited with code=1' });
  });

  describe('when the Bevy renderer is active for a project', () => {
    describe('and another project’s realm exits', () => {
      beforeEach(() => {
        renderHook(() => useBevyRealmRestart('/scenes/demo', { onRestart, onGiveUp }));
        crash('/scenes/other');
      });

      it('should neither restart nor give up', () => {
        expect([onRestart.mock.calls.length, onGiveUp.mock.calls.length]).toEqual([0, 0]);
      });
    });

    describe('and its realm exits 3 times', () => {
      beforeEach(() => {
        renderHook(() => useBevyRealmRestart('/scenes/demo', { onRestart, onGiveUp }));
        for (let i = 0; i < 3; i++) crash('/scenes/demo');
      });

      it('should restart each time without giving up', () => {
        expect([onRestart.mock.calls.length, onGiveUp.mock.calls.length]).toEqual([3, 0]);
      });

      describe('and it exits a 4th time', () => {
        beforeEach(() => {
          crash('/scenes/demo');
        });

        it('should give up once instead of restarting', () => {
          expect([onRestart.mock.calls.length, onGiveUp.mock.calls.length]).toEqual([3, 1]);
        });
      });
    });

    describe('and the project changes after 3 exits', () => {
      beforeEach(() => {
        const { rerender } = renderHook(
          ({ path }) => useBevyRealmRestart(path, { onRestart, onGiveUp }),
          { initialProps: { path: '/scenes/a' } },
        );
        for (let i = 0; i < 3; i++) crash('/scenes/a');
        rerender({ path: '/scenes/b' });
        crash('/scenes/b');
      });

      it('should restart the new project with a fresh count', () => {
        expect([onRestart.mock.calls.length, onGiveUp.mock.calls.length]).toEqual([4, 0]);
      });
    });

    describe('and the hook unmounts', () => {
      beforeEach(() => {
        const { unmount } = renderHook(() =>
          useBevyRealmRestart('/scenes/demo', { onRestart, onGiveUp }),
        );
        unmount();
      });

      it('should unsubscribe', () => {
        expect(unsubscribe).toHaveBeenCalled();
      });
    });
  });

  describe('when the Bevy renderer is not active', () => {
    beforeEach(() => {
      renderHook(() => useBevyRealmRestart(undefined, { onRestart, onGiveUp }));
    });

    it('should not subscribe', () => {
      expect(editor.onBevyRealmExit).not.toHaveBeenCalled();
    });
  });
});
