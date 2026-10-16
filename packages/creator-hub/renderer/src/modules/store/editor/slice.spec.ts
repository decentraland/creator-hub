import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PreviewOptions } from '/shared/types/settings';

import { editor } from '#preload';

import { createTestStore } from '../../../../tests/utils/testStore';
import { setDeployToken } from '../deployment/deploy-api';
import { cancelPreview, publishScene, runScene, setPreviewProgress } from './slice';

vi.mock('../deployment/deploy-api', async importOriginal => ({
  ...((await importOriginal()) as object),
  setDeployToken: vi.fn(),
}));

vi.mock('../deployment/utils', async importOriginal => ({
  ...((await importOriginal()) as object),
  fetchInfo: vi.fn(async () => ({ isWorld: false, rootCID: 'bafy' })),
  fetchFiles: vi.fn(async () => []),
}));

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

describe('editor slice publish', () => {
  let store: ReturnType<typeof createTestStore>;

  const publish = () =>
    store.dispatch(publishScene({ path: TEST_PATH, chainId: 1, wallet: '0xabc' })).unwrap();

  beforeEach(() => {
    store = createTestStore();
    vi.mocked(setDeployToken).mockClear();
  });

  describe('when the CLI hands out a deploy token', () => {
    beforeEach(async () => {
      vi.mocked(editor.publishScene).mockResolvedValue({
        port: 4100,
        supportsDeployResource: true,
        deployToken: 'token-example-123',
      });
      await publish();
    });

    it('should keep the token for the cancel requests to that CLI', () => {
      expect(setDeployToken).toHaveBeenCalledWith('http://localhost:4100/api', 'token-example-123');
    });

    it('should flag the deployment as supporting the deploy resource', () => {
      expect(store.getState().deployment.deployments[TEST_PATH]?.supportsDeployResource).toBe(true);
    });

    it('should flag the deployment as cancellable', () => {
      expect(store.getState().deployment.deployments[TEST_PATH]?.cancellable).toBe(true);
    });

    it('should keep the token out of the store', () => {
      expect(JSON.stringify(store.getState())).not.toContain('token-example-123');
    });
  });

  describe('when the CLI serves the deploy resource but takes no deploy token', () => {
    beforeEach(async () => {
      vi.mocked(editor.publishScene).mockResolvedValue({
        port: 4100,
        supportsDeployResource: true,
      });
      await publish();
    });

    it('should flag the deployment as supporting the deploy resource', () => {
      expect(store.getState().deployment.deployments[TEST_PATH]?.supportsDeployResource).toBe(true);
    });

    it('should flag the deployment as not cancellable', () => {
      expect(store.getState().deployment.deployments[TEST_PATH]?.cancellable).toBe(false);
    });
  });

  describe('when the CLI predates the deploy resource', () => {
    beforeEach(async () => {
      vi.mocked(editor.publishScene).mockResolvedValue({
        port: 4100,
        supportsDeployResource: false,
      });
      await publish();
    });

    it('should drop any token kept for that url', () => {
      expect(setDeployToken).toHaveBeenCalledWith('http://localhost:4100/api', undefined);
    });

    it('should flag the deployment as not supporting the deploy resource', () => {
      expect(store.getState().deployment.deployments[TEST_PATH]?.supportsDeployResource).toBe(
        false,
      );
    });
  });
});
