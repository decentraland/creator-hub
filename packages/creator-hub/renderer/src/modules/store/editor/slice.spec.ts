import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PreviewOptions } from '/shared/types/settings';

import { editor } from '#preload';

import { setActiveSceneClient } from '/@/modules/rpc/active-scene';
import type { SceneRpcClient } from '/@/modules/rpc/scene/client';

import { createTestStore } from '../../../../tests/utils/testStore';
import type * as DeployApi from '../deployment/deploy-api';
import { registerDeployServer } from '../deployment/deploy-api';
import {
  cancelPreview,
  killPreviewScene,
  publishScene,
  runScene,
  setPreviewProgress,
} from './slice';

vi.mock('../deployment/deploy-api', async importOriginal => {
  const actual = await importOriginal<typeof DeployApi>();
  return { ...actual, registerDeployServer: vi.fn(actual.registerDeployServer) };
});

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

describe('editor slice preview across scenes', () => {
  const OTHER_PATH = '/test/other-scene';
  let store: ReturnType<typeof createTestStore>;
  let resolveRuns: (() => void)[];
  let resolveKill: () => void;

  beforeEach(() => {
    store = createTestStore();
    resolveRuns = [];
    vi.mocked(editor.subscribePreviewProgress).mockReturnValue({ cleanup: vi.fn() });
    vi.mocked(editor.runScene).mockImplementation(
      () =>
        new Promise<never>(resolve => {
          resolveRuns.push(() => resolve(undefined as never));
        }),
    );
    vi.mocked(editor.killPreviewScene).mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveKill = resolve;
        }),
    );
  });

  describe('when the user leaves a scene whose preview is still starting', () => {
    it('should unblock the button at once and never mark the late-settling run as running', async () => {
      const run = store.dispatch(runScene({ path: TEST_PATH, ...PREVIEW_OPTS }));
      const kill = store.dispatch(killPreviewScene(TEST_PATH));

      expect(store.getState().editor.loadingPreview).toBe(false);

      resolveRuns[0]();
      await run;
      resolveKill();
      await kill;

      expect(store.getState().editor.isPreviewRunning).toBe(false);
    });

    it('should leave the loading state of a run started for the same scene after coming back', async () => {
      const stale = store.dispatch(runScene({ path: TEST_PATH, ...PREVIEW_OPTS }));
      void store.dispatch(killPreviewScene(TEST_PATH));
      const fresh = store.dispatch(runScene({ path: TEST_PATH, ...PREVIEW_OPTS }));

      resolveRuns[0]();
      await stale;

      expect(store.getState().editor.loadingPreview).toBe(true);
      expect(store.getState().editor.isPreviewRunning).toBe(false);

      resolveRuns[1]();
      await fresh;

      expect(store.getState().editor.isPreviewRunning).toBe(true);
    });
  });

  describe('when the stop of the scene left behind lands after the next scene started its preview', () => {
    it('should keep the next scene marked as running', async () => {
      const first = store.dispatch(runScene({ path: TEST_PATH, ...PREVIEW_OPTS }));
      resolveRuns[0]();
      await first;

      const kill = store.dispatch(killPreviewScene(TEST_PATH));
      const second = store.dispatch(runScene({ path: OTHER_PATH, ...PREVIEW_OPTS }));
      resolveRuns[1]();
      await second;
      resolveKill();
      await kill;

      expect(store.getState().editor.isPreviewRunning).toBe(true);
      expect(store.getState().editor.runningPreviewPath).toBe(OTHER_PATH);
    });
  });

  describe('when a scene is stopped that is not the running one', () => {
    it('should keep the running preview', async () => {
      const run = store.dispatch(runScene({ path: OTHER_PATH, ...PREVIEW_OPTS }));
      resolveRuns[0]();
      await run;

      const kill = store.dispatch(killPreviewScene(TEST_PATH));
      resolveKill();
      await kill;

      expect(store.getState().editor.isPreviewRunning).toBe(true);
    });
  });
});

describe('editor slice publish', () => {
  let store: ReturnType<typeof createTestStore>;

  const publish = () =>
    store.dispatch(publishScene({ path: TEST_PATH, chainId: 1, wallet: '0xabc' })).unwrap();

  beforeEach(() => {
    store = createTestStore();
    vi.mocked(registerDeployServer).mockClear();
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

    it('should hand the CLI and its token to the cancel requests', () => {
      expect(registerDeployServer).toHaveBeenCalledWith({
        port: 4100,
        supportsDeployResource: true,
        deployToken: 'token-example-123',
      });
    });

    it('should flag the deployment as supporting the deploy resource', () => {
      expect(store.getState().deployment.deployments[TEST_PATH]?.supportsDeployResource).toBe(true);
    });

    it('should flag the deployment as holding its cancel token', () => {
      expect(store.getState().deployment.deployments[TEST_PATH]?.hasCancelToken).toBe(true);
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

    it('should flag the deployment as holding no cancel token', () => {
      expect(store.getState().deployment.deployments[TEST_PATH]?.hasCancelToken).toBe(false);
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

    it('should hand the CLI over without a token, dropping any earlier one', () => {
      expect(registerDeployServer).toHaveBeenCalledWith({
        port: 4100,
        supportsDeployResource: false,
      });
    });

    it('should flag the deployment as not supporting the deploy resource', () => {
      expect(store.getState().deployment.deployments[TEST_PATH]?.supportsDeployResource).toBe(
        false,
      );
    });
  });

  describe('when the user publishes again over an earlier deployment', () => {
    let replacedWhenMainStarts: boolean | undefined;

    beforeEach(async () => {
      vi.mocked(editor.publishScene).mockResolvedValue({
        port: 4100,
        supportsDeployResource: true,
      });
      await publish();
      vi.mocked(editor.publishScene).mockImplementation(async () => {
        replacedWhenMainStarts = store.getState().deployment.deployments[TEST_PATH]?.replaced;
        return { port: 4101, supportsDeployResource: true };
      });
      await publish();
    });

    it('should mark the earlier deployment as replaced before main starts the new CLI', () => {
      expect(replacedWhenMainStarts).toBe(true);
    });

    it('should start the new deployment unmarked', () => {
      expect(store.getState().deployment.deployments[TEST_PATH]?.replaced).toBeUndefined();
    });
  });
});

describe('editor slice publish flush', () => {
  let store: ReturnType<typeof createTestStore>;
  const saveScene = vi.fn();

  const PUBLISH_OPTS = {
    path: TEST_PATH,
    chainId: 1 as never,
    wallet: '0xwallet',
    target: 'https://peer.decentraland.org',
  };

  beforeEach(() => {
    store = createTestStore();
    saveScene.mockReset();
    setActiveSceneClient({ saveScene } as unknown as SceneRpcClient);
    vi.mocked(editor.publishScene).mockResolvedValue({ port: 3000, supportsDeployResource: false });
  });

  afterEach(() => {
    setActiveSceneClient(null);
  });

  describe('when the editor still has unsaved work', () => {
    it('should flush it to disk before the deploy reads the project', async () => {
      const order: string[] = [];
      saveScene.mockImplementation(async () => {
        order.push('save');
      });
      vi.mocked(editor.publishScene).mockImplementation(async () => {
        order.push('publish');
        return { port: 3000, supportsDeployResource: false };
      });

      await store.dispatch(publishScene(PUBLISH_OPTS));

      expect(order).toEqual(['save', 'publish']);
    });
  });

  describe('when the flush fails', () => {
    beforeEach(() => {
      saveScene.mockRejectedValue(new Error('EBUSY: resource busy or locked'));
    });

    // Deploying here would publish the previous scene.json under a success message, leaving
    // the creator with no signal that their changes did not go live.
    it('should not start the deploy', async () => {
      await store.dispatch(publishScene(PUBLISH_OPTS));

      expect(editor.publishScene).not.toHaveBeenCalled();
    });

    it('should leave an earlier deployment of the scene retryable', async () => {
      saveScene.mockResolvedValueOnce(undefined);
      await store.dispatch(publishScene(PUBLISH_OPTS));
      vi.mocked(editor.publishScene).mockClear();

      await store.dispatch(publishScene(PUBLISH_OPTS));

      expect(editor.publishScene).not.toHaveBeenCalled();
      expect(store.getState().deployment.deployments[TEST_PATH]?.replaced).toBeUndefined();
    });

    it('should surface the reason instead of failing silently', async () => {
      await store.dispatch(publishScene(PUBLISH_OPTS));

      expect(store.getState().editor.loadingPublish).toBe(false);
      expect(store.getState().editor.publishError).toContain('EBUSY');
    });
  });

  describe('when the open inspector predates the save_scene RPC', () => {
    beforeEach(() => {
      saveScene.mockRejectedValue(new Error('Method "save_scene" not implemented'));
    });

    it('should publish as it did before the flush existed', async () => {
      await store.dispatch(publishScene(PUBLISH_OPTS));

      expect(editor.publishScene).toHaveBeenCalled();
      expect(store.getState().editor.publishError).toBeNull();
    });
  });

  describe('when no editor is open', () => {
    beforeEach(() => {
      setActiveSceneClient(null);
    });

    it('should publish without a flush rather than block', async () => {
      await store.dispatch(publishScene(PUBLISH_OPTS));

      expect(saveScene).not.toHaveBeenCalled();
      expect(editor.publishScene).toHaveBeenCalled();
    });
  });
});
