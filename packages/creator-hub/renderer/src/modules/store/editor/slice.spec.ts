import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PreviewOptions } from '/shared/types/settings';

import { editor } from '#preload';

import { createTestStore } from '../../../../tests/utils/testStore';
import { cancelPreview, runScene, setPreviewProgress } from './slice';

const TEST_PATH = '/test/scene';
const PREVIEW_OPTS: PreviewOptions = {
  debugger: false,
  skipAuthScreen: true,
  enableLandscapeTerrains: false,
  openNewInstance: false,
  multiInstance: false,
  showWarnings: false,
  optimizedAssets: true,
};

describe('editor slice preview state', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    vi.mocked(editor.subscribePreviewProgress).mockReturnValue({ cleanup: vi.fn() });
    vi.mocked(editor.cancelPreview).mockResolvedValue(undefined);
  });

  describe('when running a scene that opens normally', () => {
    beforeEach(() => {
      vi.mocked(editor.runScene).mockResolvedValue(undefined as never);
    });

    it('should mark the preview as running once the run settles', async () => {
      const promise = store.dispatch(runScene({ path: TEST_PATH, ...PREVIEW_OPTS }));

      expect(store.getState().editor.loadingPreview).toBe(true);

      await promise;

      expect(store.getState().editor.loadingPreview).toBe(false);
      expect(store.getState().editor.isPreviewRunning).toBe(true);
      expect(store.getState().editor.previewCancelled).toBe(false);
    });
  });

  describe('when the preview is cancelled while converting', () => {
    let resolveRun: () => void;

    beforeEach(() => {
      vi.mocked(editor.runScene).mockImplementation(
        () =>
          new Promise<never>(resolve => {
            resolveRun = () => resolve(undefined as never);
          }),
      );
    });

    it('should keep the button blocked until the cancel completes and never mark the preview as running', async () => {
      const promise = store.dispatch(runScene({ path: TEST_PATH, ...PREVIEW_OPTS }));

      expect(store.getState().editor.loadingPreview).toBe(true);

      let resolveCancel!: () => void;
      vi.mocked(editor.cancelPreview).mockImplementation(
        () =>
          new Promise<void>(resolve => {
            resolveCancel = resolve;
          }),
      );
      const cancelDispatch = store.dispatch(cancelPreview(TEST_PATH));

      // main is still killing the spawn: a press now would ride the dying spawn and
      // report a preview that never opened, so the button must stay blocked
      expect(store.getState().editor.loadingPreview).toBe(true);
      expect(store.getState().editor.previewCancelled).toBe(true);

      resolveCancel();
      await cancelDispatch;

      // the process is confirmed dead: the button unblocks
      expect(store.getState().editor.loadingPreview).toBe(false);

      // the held start() resolves quietly
      resolveRun();
      await promise;

      expect(store.getState().editor.isPreviewRunning).toBe(false);
      expect(store.getState().editor.previewCancelled).toBe(false);
    });

    it('should keep the loading state of a run started while the cancel was still in flight', async () => {
      const first = store.dispatch(runScene({ path: TEST_PATH, ...PREVIEW_OPTS }));

      let resolveCancel!: () => void;
      vi.mocked(editor.cancelPreview).mockImplementation(
        () =>
          new Promise<void>(resolve => {
            resolveCancel = resolve;
          }),
      );
      const cancelDispatch = store.dispatch(cancelPreview(TEST_PATH));

      // the cancelled run settles quietly while the cancel round trip is still pending
      resolveRun();
      await first;

      // a new run (e.g. a mobile-QR start) begins before the cancel completes
      const second = store.dispatch(runScene({ path: TEST_PATH, ...PREVIEW_OPTS }));
      expect(store.getState().editor.loadingPreview).toBe(true);

      resolveCancel();
      await cancelDispatch;

      // the late cancel fulfillment must not unblock the new run's loading state
      expect(store.getState().editor.loadingPreview).toBe(true);

      resolveRun();
      await second;

      expect(store.getState().editor.isPreviewRunning).toBe(true);
    });

    it('should reset the cancelled flag when a new run starts', async () => {
      const promise = store.dispatch(runScene({ path: TEST_PATH, ...PREVIEW_OPTS }));
      await store.dispatch(cancelPreview(TEST_PATH));
      resolveRun();
      await promise;

      const second = store.dispatch(runScene({ path: TEST_PATH, ...PREVIEW_OPTS }));

      expect(store.getState().editor.previewCancelled).toBe(false);
      expect(store.getState().editor.loadingPreview).toBe(true);

      resolveRun();
      await second;

      expect(store.getState().editor.isPreviewRunning).toBe(true);
    });
  });

  describe('when the run fails', () => {
    beforeEach(() => {
      vi.mocked(editor.runScene).mockRejectedValue(new Error('boom'));
    });

    it('should clear the loading state without marking the preview as running', async () => {
      await store.dispatch(runScene({ path: TEST_PATH, ...PREVIEW_OPTS }));

      expect(store.getState().editor.loadingPreview).toBe(false);
      expect(store.getState().editor.isPreviewRunning).toBe(false);
      expect(store.getState().editor.previewCancelled).toBe(false);
    });
  });

  describe('when preview progress is reported', () => {
    it('should store the progress and clear it on null', () => {
      store.dispatch(setPreviewProgress({ seconds: 0, done: 3, total: 10 }));

      expect(store.getState().editor.previewProgress).toEqual({ seconds: 0, done: 3, total: 10 });

      store.dispatch(setPreviewProgress(null));

      expect(store.getState().editor.previewProgress).toBeNull();
    });
  });
});
