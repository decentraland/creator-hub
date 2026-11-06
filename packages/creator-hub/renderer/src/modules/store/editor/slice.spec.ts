import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Project } from '/shared/types/projects';
import type { PreviewOptions } from '/shared/types/settings';

import { editor, scene } from '#preload';

import {
  notifyActiveSceneReady,
  pendingReadyWaiters,
  setActiveSceneClient,
} from '/@/modules/rpc/active-scene';
import { type SceneRpcClient, SceneRpcUnsupportedError } from '/@/modules/rpc/scene/client';

import { createTestStore } from '../../../../tests/utils/testStore';
import type * as DeployApi from '../deployment/deploy-api';
import { registerDeployServer } from '../deployment/deploy-api';
import { actions as workspaceActions } from '../workspace';
import { killPreviewScene, publishScene, runScene } from './slice';

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
  loadRawGltfs: false,
};
describe('editor slice preview state', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
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
    });
  });
});

describe('editor slice SDK capability flags', () => {
  const AUTH_SERVER_SDK_VERSION = '7.29.1-35154657340.commit-e2bbcc9';
  const PROJECT: Project = {
    id: 'test-project',
    path: TEST_PATH,
    title: 'Test scene',
    thumbnail: '',
    layout: { rows: 1, cols: 1 },
    scene: { base: '0,0', parcels: ['0,0'] },
    createdAt: 0,
    updatedAt: 0,
    publishedAt: 0,
    size: 0,
    dependencyAvailableUpdates: {},
    info: { id: 'test-project', skipPublishWarning: false },
  };
  const fetchVersionFulfilled = (hasAuthServer: boolean) =>
    workspaceActions.fetchSdkCommandsVersion.fulfilled(
      { version: AUTH_SERVER_SDK_VERSION, hasAuthServer },
      'request-id',
      TEST_PATH,
    );

  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe('when the version fetch reports the auth-server runtime', () => {
    beforeEach(() => {
      store.dispatch(fetchVersionFulfilled(true));
    });

    it('should support the auth server', () => {
      expect(store.getState().editor.supportsAuthServer).toBe(true);
    });

    it('should still derive the UI designer support from the version', () => {
      expect(store.getState().editor.supportsUiDesigner).toBe(true);
    });

    it('should drop the auth server support when another scene starts running', () => {
      store.dispatch(workspaceActions.runProject.pending('request-id', PROJECT));

      expect(store.getState().editor.supportsAuthServer).toBe(false);
    });
  });

  describe('when the version fetch reports no auth-server runtime', () => {
    beforeEach(() => {
      store.dispatch(fetchVersionFulfilled(false));
    });

    it('should not support the auth server', () => {
      expect(store.getState().editor.supportsAuthServer).toBe(false);
    });

    it('should still derive the UI designer support from the version', () => {
      expect(store.getState().editor.supportsUiDesigner).toBe(true);
    });
  });

  describe('when a project is opened', () => {
    it('should enable the flags from a version fetch for that project', () => {
      store.dispatch(workspaceActions.runProject.pending('request-id', PROJECT));
      store.dispatch(fetchVersionFulfilled(true));

      expect(store.getState().editor.supportsAuthServer).toBe(true);
      expect(store.getState().editor.supportsUiDesigner).toBe(true);
    });

    it('should ignore a version fetch that resolves for a different project', () => {
      store.dispatch(workspaceActions.runProject.pending('request-id', PROJECT));
      store.dispatch(
        workspaceActions.fetchSdkCommandsVersion.fulfilled(
          { version: AUTH_SERVER_SDK_VERSION, hasAuthServer: true },
          'other-request',
          '/some/other/scene',
        ),
      );

      expect(store.getState().editor.supportsAuthServer).toBe(false);
      expect(store.getState().editor.supportsUiDesigner).toBe(false);
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
      saveScene.mockRejectedValue(new SceneRpcUnsupportedError('save_scene'));
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

describe('editor slice publish with a placement picked in the publish dialog', () => {
  let store: ReturnType<typeof createTestStore>;
  let order: string[];
  let sceneJson: Record<string, unknown>;
  const saveScene = vi.fn();
  const setSceneSettings = vi.fn();
  const getSceneSettings = vi.fn();
  let editorLayout: unknown;

  const PICKED = { base: '50,60', parcels: ['50,60', '51,60'] };
  const publishTo = (sceneUpdates: Record<string, unknown>) =>
    store.dispatch(
      publishScene({
        path: TEST_PATH,
        chainId: 1 as never,
        wallet: '0xwallet',
        target: 'https://peer.decentraland.org',
        sceneUpdates,
      }),
    );

  beforeEach(() => {
    store = createTestStore();
    order = [];
    sceneJson = {
      display: { title: 'My scene' },
      scene: { base: '0,0', parcels: ['0,0', '1,0'] },
      worldConfiguration: { name: 'old-world.dcl.eth' },
    };
    saveScene.mockReset().mockImplementation(async () => {
      order.push('save');
    });
    editorLayout = { base: { x: 0, y: 0 }, parcels: [{ x: 0, y: 0 }] };
    setSceneSettings.mockReset().mockImplementation(async ({ layout }) => {
      order.push('push');
      editorLayout = layout;
      return { settings: {} };
    });
    getSceneSettings.mockReset().mockImplementation(async () => ({
      settings: { layout: editorLayout },
    }));
    setActiveSceneClient({
      saveScene,
      setSceneSettings,
      getSceneSettings,
    } as unknown as SceneRpcClient);
    vi.mocked(scene.getScene).mockImplementation(async () => structuredClone(sceneJson) as never);
    vi.mocked(scene.writeScene).mockImplementation(async ({ scene: written }) => {
      order.push('write');
      sceneJson = JSON.parse(JSON.stringify(written));
    });
    vi.mocked(editor.publishScene).mockImplementation(async () => {
      order.push('publish');
      return { port: 3000, supportsDeployResource: false };
    });
  });

  afterEach(() => {
    setActiveSceneClient(null);
  });

  describe('when the editor is open', () => {
    it('should hand the layout to the editor, flush, write the pick, then deploy', async () => {
      await publishTo({ scene: PICKED, worldConfiguration: undefined });

      expect(order).toEqual(['push', 'save', 'write', 'publish']);
      expect(setSceneSettings).toHaveBeenCalledWith({
        layout: {
          base: { x: 50, y: 60 },
          parcels: [
            { x: 50, y: 60 },
            { x: 51, y: 60 },
          ],
        },
      });
    });

    it('should deploy a scene.json holding the picked parcels and no world', async () => {
      await publishTo({ scene: PICKED, worldConfiguration: undefined });

      expect(sceneJson.scene).toEqual(PICKED);
      expect(sceneJson.worldConfiguration).toBeUndefined();
      expect(sceneJson.display).toEqual({ title: 'My scene' });
    });

    it('should deploy a scene.json holding the picked world', async () => {
      await publishTo({
        scene: { base: '0,0', parcels: ['0,0', '1,0'] },
        worldConfiguration: { name: 'my-world.dcl.eth' },
      });

      expect(sceneJson.worldConfiguration).toEqual({ name: 'my-world.dcl.eth' });
      expect(order).toEqual(['push', 'save', 'write', 'publish']);
    });
  });

  // The flush rewrites scene.json from the editor; a data layer bundled in an older
  // sdk-commands writes its whole load-time copy and reverts the pick on disk.
  describe('when the flush writes the old placement back', () => {
    beforeEach(() => {
      saveScene.mockImplementation(async () => {
        order.push('save');
        sceneJson = { ...sceneJson, scene: { base: '0,0', parcels: ['0,0', '1,0'] } };
      });
    });

    it('should still deploy the picked parcels', async () => {
      await publishTo({ scene: PICKED, worldConfiguration: undefined });

      expect(sceneJson.scene).toEqual(PICKED);
      expect(editor.publishScene).toHaveBeenCalled();
    });
  });

  // Under Bevy an edit can reload the inspector iframe in place; a request sent during the
  // reload reaches no server and would only time out.
  describe('when the editor reloads while the placement is being handed to it', () => {
    let client: SceneRpcClient;

    beforeEach(() => {
      client = { saveScene, setSceneSettings, getSceneSettings } as unknown as SceneRpcClient;
      setActiveSceneClient(client);
      setSceneSettings.mockImplementationOnce(() => {
        order.push('lost');
        setTimeout(() => notifyActiveSceneReady(client), 10);
        return new Promise(() => undefined);
      });
    });

    it('should hand it again to the reloaded editor before flushing', async () => {
      await publishTo({ scene: PICKED, worldConfiguration: undefined });

      expect(order).toEqual(['lost', 'push', 'save', 'write', 'publish']);
    });
  });

  describe('when the editor reloads twice in a row while the placement is handed over', () => {
    let client: SceneRpcClient;

    beforeEach(() => {
      client = { saveScene, setSceneSettings, getSceneSettings } as unknown as SceneRpcClient;
      setActiveSceneClient(client);
      const lostToReload = () => {
        order.push('lost');
        setTimeout(() => notifyActiveSceneReady(client), 10);
        return new Promise(() => undefined);
      };
      setSceneSettings.mockImplementationOnce(lostToReload).mockImplementationOnce(lostToReload);
    });

    it('should hand it to the editor that finally stays up', async () => {
      await publishTo({ scene: PICKED, worldConfiguration: undefined });

      expect(order).toEqual(['lost', 'lost', 'push', 'save', 'write', 'publish']);
    });
  });

  describe('when the editor reloads while it is being flushed', () => {
    let client: SceneRpcClient;

    beforeEach(() => {
      client = { saveScene, setSceneSettings, getSceneSettings } as unknown as SceneRpcClient;
      setActiveSceneClient(client);
      saveScene.mockImplementationOnce(() => {
        order.push('lost');
        setTimeout(() => notifyActiveSceneReady(client), 10);
        return new Promise(() => undefined);
      });
    });

    it('should flush the reloaded editor and deploy', async () => {
      await publishTo({ scene: PICKED, worldConfiguration: undefined });

      expect(order).toEqual(['push', 'lost', 'save', 'write', 'publish']);
      expect(store.getState().editor.publishError).toBeNull();
    });
  });

  // Under Bevy, storing the pick reloads the inspector; the iframe on its way out can answer
  // the edit without its data layer ever receiving it.
  describe('when the editor answered the placement but lost it in a reload', () => {
    beforeEach(() => {
      setSceneSettings.mockImplementationOnce(async () => {
        order.push('lost');
        return { settings: {} };
      });
    });

    it('should hand it over and flush again until the editor holds it', async () => {
      await publishTo({ scene: PICKED, worldConfiguration: undefined });

      expect(order).toEqual(['lost', 'save', 'push', 'save', 'write', 'publish']);
      expect(editorLayout).toEqual({
        base: { x: 50, y: 60 },
        parcels: [
          { x: 50, y: 60 },
          { x: 51, y: 60 },
        ],
      });
    });
  });

  describe('when the editor lists the picked parcels in another order', () => {
    beforeEach(() => {
      getSceneSettings.mockImplementation(async () => ({
        settings: {
          layout: {
            base: { x: 50, y: 60 },
            parcels: [
              { x: 51, y: 60 },
              { x: 50, y: 60 },
            ],
          },
        },
      }));
    });

    it('should accept it as kept rather than hand it over again', async () => {
      await publishTo({ scene: PICKED, worldConfiguration: undefined });

      expect(order).toEqual(['push', 'save', 'write', 'publish']);
    });
  });

  describe('when the publish is done', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should leave no wait for the editor and no timer behind', async () => {
      const publishing = publishTo({ scene: PICKED, worldConfiguration: undefined });
      await vi.runAllTimersAsync();
      await publishing;

      expect(order.at(-1)).toBe('publish');
      expect(pendingReadyWaiters()).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('with an editor that answers slowly or not at all', () => {
    let client: SceneRpcClient;
    const unanswered = () => new Promise<never>(() => undefined);

    beforeEach(() => {
      vi.useFakeTimers();
      client = { saveScene, setSceneSettings, getSceneSettings } as unknown as SceneRpcClient;
      setActiveSceneClient(client);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe('and the iframe takes longer than the placement budget to come back mid-flush', () => {
      beforeEach(() => {
        saveScene.mockImplementationOnce(() => {
          order.push('lost');
          return unanswered();
        });
      });

      it('should flush the recovered editor and deploy, without a save error', async () => {
        const publishing = publishTo({ scene: PICKED, worldConfiguration: undefined });
        await vi.advanceTimersByTimeAsync(20_000);
        notifyActiveSceneReady(client);
        await vi.runAllTimersAsync();
        await publishing;

        expect(order).toEqual(['push', 'lost', 'save', 'write', 'publish']);
        expect(store.getState().editor.publishError).toBeNull();
      });
    });

    // #1512: the editor's pending edits may not be on disk, so this must not deploy.
    describe('and the editor never answers the flush nor reloads', () => {
      beforeEach(() => {
        saveScene.mockImplementation(unanswered);
      });

      it('should stop the publish with the save error once the flush budget runs out', async () => {
        const publishing = publishTo({ scene: PICKED, worldConfiguration: undefined });
        await vi.advanceTimersByTimeAsync(60_000);
        await publishing;

        expect(editor.publishScene).not.toHaveBeenCalled();
        expect(store.getState().editor.publishError).toContain('save_scene');
      });
    });

    describe('and the editor answers the flush of the reloaded iframe with an error', () => {
      beforeEach(() => {
        saveScene
          .mockImplementationOnce(() => {
            setTimeout(() => notifyActiveSceneReady(client), 10);
            return unanswered();
          })
          .mockRejectedValueOnce(new Error('EBUSY: resource busy or locked'));
      });

      it('should stop the publish', async () => {
        const publishing = publishTo({ scene: PICKED, worldConfiguration: undefined });
        await vi.runAllTimersAsync();
        await publishing;

        expect(editor.publishScene).not.toHaveBeenCalled();
        expect(store.getState().editor.publishError).toContain('EBUSY');
      });
    });

    // Handing the placement over is best effort: the last disk write carries the pick.
    describe('and the editor never answers the placement', () => {
      beforeEach(() => {
        setSceneSettings.mockImplementation(unanswered);
      });

      it('should give up on it within the placement budget and still deploy the pick', async () => {
        const publishing = publishTo({ scene: PICKED, worldConfiguration: undefined });
        await vi.advanceTimersByTimeAsync(15_000);
        await publishing;

        expect(order).toEqual(['save', 'write', 'publish']);
        expect(sceneJson.scene).toEqual(PICKED);
      });
    });

    describe('and the editor never answers the read-back', () => {
      beforeEach(() => {
        getSceneSettings.mockImplementation(unanswered);
      });

      it('should still deploy the pick once the placement budget runs out', async () => {
        const publishing = publishTo({ scene: PICKED, worldConfiguration: undefined });
        await vi.advanceTimersByTimeAsync(15_000);
        await vi.runAllTimersAsync();
        await publishing;

        expect(order.at(-1)).toBe('publish');
        expect(sceneJson.scene).toEqual(PICKED);
      });
    });
  });

  describe('when the editor rejects the placement', () => {
    beforeEach(() => {
      setSceneSettings.mockRejectedValue(new Error('layout.base must be integer { x, y } coords'));
    });

    it('should still deploy the pick without waiting for a reload', async () => {
      const started = Date.now();
      await publishTo({ scene: PICKED, worldConfiguration: undefined });

      expect(order).toEqual(['save', 'write', 'publish']);
      expect(Date.now() - started).toBeLessThan(1000);
      expect(sceneJson.scene).toEqual(PICKED);
    });
  });

  describe('when the open editor predates set_scene_settings', () => {
    beforeEach(() => {
      setSceneSettings.mockRejectedValue(new SceneRpcUnsupportedError('set_scene_settings'));
    });

    it('should still flush, write the pick and deploy', async () => {
      await publishTo({ scene: PICKED, worldConfiguration: undefined });

      expect(order).toEqual(['save', 'write', 'publish']);
      expect(sceneJson.scene).toEqual(PICKED);
      expect(store.getState().editor.publishError).toBeNull();
    });
  });

  describe('when the flush fails', () => {
    beforeEach(() => {
      saveScene.mockRejectedValue(new Error('EBUSY: resource busy or locked'));
    });

    it('should not start the deploy and surface the reason', async () => {
      await publishTo({ scene: PICKED, worldConfiguration: undefined });

      expect(editor.publishScene).not.toHaveBeenCalled();
      expect(store.getState().editor.publishError).toContain('EBUSY');
    });
  });

  describe('when no editor is open', () => {
    beforeEach(() => {
      setActiveSceneClient(null);
    });

    it('should write the pick to disk and deploy', async () => {
      await publishTo({ scene: PICKED, worldConfiguration: undefined });

      expect(order).toEqual(['write', 'publish']);
      expect(sceneJson.scene).toEqual(PICKED);
    });
  });
});
