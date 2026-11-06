import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flatten } from 'flat';
import type { ChainId, Scene } from '@dcl/schemas';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import type { Project } from '/shared/types/projects';
import { editor, scene } from '#preload';

import { AuthContext } from '/@/contexts/AuthContext';
import { setActiveSceneClient } from '/@/modules/rpc/active-scene';
import type { SceneRpcClient } from '/@/modules/rpc/scene/client';
import { fetchENSList } from '/@/modules/store/ens';
import { ENSProvider } from '/@/modules/store/ens/types';
import { actions as workspaceActions } from '/@/modules/store/workspace';
import en from '/@/modules/store/translation/locales/en.json';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { createTestStore } from '../../../../../../tests/utils/testStore';
import { PublishToWorld } from './component';

/** The real store module boots the app on import. */
vi.mock('#store', async () => {
  const { useDispatch, useSelector } = await import('react-redux');
  return { useDispatch, useSelector };
});

/** The ui2 modal shell and the wallet summary read theme slices this environment does
 * not populate; the flow under test lives in the step, not the chrome. */
vi.mock('../../PublishModal', () => ({
  PublishModal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../ProjectStepWrapper', () => ({
  ProjectStepWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

/** The worlds client calls `decentraland-crypto-fetch`, which on Node 24 bypasses a stubbed global
 * fetch and hits undici with jsdom's AbortSignal. Route it through the global so the stub
 * below answers it on every Node version. */
vi.mock('decentraland-crypto-fetch', async importOriginal => ({
  ...((await importOriginal()) as object),
  default: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
}));

vi.mock('/@/modules/store/deployment/utils', async importOriginal => ({
  ...((await importOriginal()) as object),
  fetchInfo: vi.fn(async () => ({ isWorld: true, rootCID: 'bafy' })),
  fetchFiles: vi.fn(async () => []),
}));

const WALLET = '0xowner';
const WORLD = 'my-world.dcl.eth';
const PROJECT = {
  id: 'project-id',
  path: '/scenes/my-scene',
  title: 'My scene',
  thumbnail: '',
  layout: { rows: 1, cols: 2 },
  scene: { base: '5,5', parcels: ['5,5', '6,5'] },
  createdAt: 0,
  updatedAt: 0,
  publishedAt: 0,
  size: 0,
  worldConfiguration: { name: WORLD },
  dependencyAvailableUpdates: {},
  info: { id: 'project-id', skipPublishWarning: false },
} as Project;

type EditorLayout = {
  base: { x: number; y: number };
  parcels: { x: number; y: number }[];
};

describe('PublishToWorld', () => {
  let store: ReturnType<typeof createTestStore>;
  let order: string[];
  let sceneJson: Scene;
  let deployedSceneJson: Scene | undefined;
  let onStep: ReturnType<typeof vi.fn>;

  const publishToTheWorld = async () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <ThemeProvider theme={dark}>
            <AuthContext.Provider value={{ wallet: WALLET, chainId: 11155111 as ChainId } as never}>
              <PublishToWorld
                open
                project={PROJECT}
                onClose={vi.fn()}
                onStep={onStep}
              />
            </AuthContext.Provider>
          </ThemeProvider>
        </MemoryRouter>
      </Provider>,
    );
    const action = await screen.findByTestId('publish-modal-publish-to-world-select-world-action');
    await waitFor(() => expect((action as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(action);
    await waitFor(() => expect(onStep).toHaveBeenCalledWith('deploy', expect.anything()));
    await waitFor(() => expect(deployedSceneJson).toBeDefined());
  };

  beforeEach(() => {
    // The worlds server answers for an empty world: no settings yet (404) and no scenes. Every
    // other request fails, which the publish to an owned, empty world does not need.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes(`/world/${WORLD}/settings`)) return new Response(null, { status: 404 });
        if (url.includes(`/world/${WORLD}/scenes`)) return Response.json({ scenes: [], total: 0 });
        throw new Error('offline');
      }),
    );
    setCurrentLocale('en', flatten(en));
    store = createTestStore();
    store.dispatch(
      workspaceActions.createProject.fulfilled(PROJECT, 'request-id', undefined as never),
    );
    store.dispatch(fetchENSList.pending('request-id', { address: WALLET }));
    store.dispatch(
      fetchENSList.fulfilled(
        [
          {
            subdomain: WORLD,
            name: 'my-world',
            provider: ENSProvider.DCL,
            nftOwnerAddress: WALLET,
            ensOwnerAddress: WALLET,
          } as never,
        ],
        'request-id',
        { address: WALLET },
      ),
    );
    order = [];
    deployedSceneJson = undefined;
    onStep = vi.fn();
    // scene.json as the editor loaded it: on LAND, with no world.
    const loaded = {
      display: { title: 'My scene' },
      scene: { base: '5,5', parcels: ['5,5', '6,5'] },
    } as Scene;
    sceneJson = structuredClone(loaded);
    // Behaves like the open editor in a data layer bundled in an older sdk-commands: its
    // save writes the copy it loaded, with whatever layout it holds in memory.
    let editorLayout = loaded.scene;
    let pushedLayout: EditorLayout | undefined;
    const saveScene = vi.fn(async () => {
      order.push('save');
      sceneJson = { ...structuredClone(loaded), scene: editorLayout };
    });
    const setSceneSettings = vi.fn(async ({ layout }: { layout: EditorLayout }) => {
      order.push('push');
      const toId = ({ x, y }: { x: number; y: number }) => `${x},${y}`;
      editorLayout = { base: toId(layout.base), parcels: layout.parcels.map(toId) };
      pushedLayout = layout;
      return { settings: {} };
    });
    const getSceneSettings = async () => ({ settings: { layout: pushedLayout } });
    setActiveSceneClient({
      saveScene,
      setSceneSettings,
      getSceneSettings,
    } as unknown as SceneRpcClient);
    vi.mocked(scene.getScene).mockImplementation(async () => structuredClone(sceneJson));
    vi.mocked(scene.writeScene).mockImplementation(async ({ scene: written }) => {
      order.push('write');
      sceneJson = JSON.parse(JSON.stringify(written));
    });
    vi.mocked(editor.publishScene).mockImplementation(async () => {
      order.push('publish');
      deployedSceneJson = structuredClone(sceneJson);
      return { port: 3000, supportsDeployResource: false };
    });
  });

  afterEach(() => {
    setActiveSceneClient(null);
    vi.unstubAllGlobals();
  });

  describe('when publishing to a world with the editor open', () => {
    it('should deploy a scene.json naming the world, placed at the world origin', async () => {
      await publishToTheWorld();

      expect(deployedSceneJson?.worldConfiguration).toEqual({ name: WORLD });
      expect(deployedSceneJson?.scene).toEqual({ base: '0,0', parcels: ['0,0', '1,0'] });
    });

    it('should write the world after the editor flush and before the deploy', async () => {
      await publishToTheWorld();

      expect(order.indexOf('push')).toBeLessThan(order.indexOf('save'));
      expect(order.lastIndexOf('write')).toBeGreaterThan(order.indexOf('save'));
      expect(order.at(-1)).toBe('publish');
    });
  });
});
