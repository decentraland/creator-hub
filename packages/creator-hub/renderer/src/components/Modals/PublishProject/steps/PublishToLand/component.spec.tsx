import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { flatten } from 'flat';
import type { ChainId, Scene } from '@dcl/schemas';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import type { Project } from '/shared/types/projects';
import { editor, scene } from '#preload';

import { AuthContext } from '/@/contexts/AuthContext';
import { type LandDeployment, Lands } from '/@/lib/land';
import { setActiveSceneClient } from '/@/modules/rpc/active-scene';
import type { SceneRpcClient } from '/@/modules/rpc/scene/client';
import { actions as workspaceActions } from '/@/modules/store/workspace';
import en from '/@/modules/store/translation/locales/en.json';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { createTestStore } from '../../../../../../tests/utils/testStore';
import { PublishToLand } from './component';

/** The real store module boots the app on import. */
vi.mock('#store', async () => {
  const { useDispatch, useSelector } = await import('react-redux');
  return { useDispatch, useSelector };
});

/** The ui2 modal shell reads breakpoints this environment does not populate. */
vi.mock('../../PublishModal', () => ({
  PublishModal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// The real atlas draws on a canvas; this one lets the test hover and pick a parcel.
vi.mock('decentraland-ui2/dist/components/Atlas/Atlas', () => ({
  Atlas: ({
    onHover,
    onClick,
  }: {
    onHover: (x: number, y: number) => void;
    onClick: (x: number, y: number) => void;
  }) => (
    <button
      onMouseEnter={() => onHover(70, 80)}
      onClick={() => onClick(70, 80)}
    >
      Parcel 70,80
    </button>
  ),
}));

const LAND_TILES = Object.fromEntries(
  ['50,60', '70,80', '71,80'].map(id => [id, { color: '#000', land: { owner: '0xowner' } }]),
);
vi.mock('/@/modules/store/land', async importOriginal => {
  const actual = (await importOriginal()) as { selectors: object };
  return { ...actual, selectors: { ...actual.selectors, getLandTiles: () => LAND_TILES } };
});

vi.mock('/@/modules/store/deployment/utils', async importOriginal => ({
  ...((await importOriginal()) as object),
  fetchInfo: vi.fn(async () => ({ isWorld: false, rootCID: 'bafy' })),
  fetchFiles: vi.fn(async () => []),
}));

const PROJECT_PATH = '/scenes/my-scene';
const PROJECT = {
  id: 'project-id',
  path: PROJECT_PATH,
  title: 'My scene',
  thumbnail: '',
  layout: { rows: 1, cols: 2 },
  scene: { base: '0,0', parcels: ['0,0', '1,0'] },
  createdAt: 0,
  updatedAt: 0,
  publishedAt: 0,
  size: 0,
  worldConfiguration: { name: 'old-world.dcl.eth' },
  dependencyAvailableUpdates: {},
  info: { id: 'project-id', skipPublishWarning: false },
} as Project;

type EditorLayout = {
  base: { x: number; y: number };
  parcels: { x: number; y: number }[];
};

describe('PublishToLand', () => {
  let store: ReturnType<typeof createTestStore>;
  let order: string[];
  let sceneJson: Scene;
  let deployedSceneJson: Scene | undefined;
  let saveScene: Mock<[], Promise<void>>;
  let setSceneSettings: Mock<[{ layout: EditorLayout }], Promise<{ settings: object }>>;
  let onStep: Mock;

  const renderStep = () =>
    render(
      <Provider store={store}>
        <MemoryRouter>
          <ThemeProvider theme={dark}>
            <AuthContext.Provider
              value={
                {
                  wallet: '0xowner',
                  chainId: 11155111 as ChainId,
                } as never
              }
            >
              <PublishToLand
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

  const pickParcel7080AndPublish = async () => {
    renderStep();
    const parcel = await screen.findByRole('button', { name: 'Parcel 70,80' });
    act(() => {
      fireEvent.mouseEnter(parcel);
    });
    act(() => {
      fireEvent.click(parcel);
    });
    await screen.findByText(/70,80/, {
      selector: '[data-testid="publish-modal-publish-to-land-placement"]',
    });
    fireEvent.click(screen.getByTestId('publish-modal-publish-to-land-action'));
    await waitFor(() => expect(onStep).toHaveBeenCalledWith('deploy'));
  };

  beforeEach(() => {
    setCurrentLocale('en', flatten(en));
    store = createTestStore();
    store.dispatch(
      workspaceActions.createProject.fulfilled(PROJECT, 'request-id', undefined as never),
    );
    order = [];
    deployedSceneJson = undefined;
    onStep = vi.fn();
    sceneJson = {
      display: { title: 'My scene' },
      scene: { base: '0,0', parcels: ['0,0', '1,0'] },
      worldConfiguration: { name: 'old-world.dcl.eth' },
    } as Scene;
    // Behaves like the open editor: its save writes the layout it holds in memory, which
    // is the one it loaded unless the placement was handed to it.
    let editorLayout = { base: '0,0', parcels: ['0,0', '1,0'] };
    let pushedLayout: EditorLayout | undefined;
    saveScene = vi.fn(async () => {
      order.push('save');
      sceneJson = { ...sceneJson, scene: editorLayout };
    });
    setSceneSettings = vi.fn(async ({ layout }: { layout: EditorLayout }) => {
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
    // Nothing deployed on the picked parcels yet, so the Place continuity check never warns.
    vi.spyOn(Lands.prototype, 'fetchLandPublishedScenes').mockResolvedValue([]);
    vi.mocked(editor.publishScene).mockImplementation(async () => {
      order.push('publish');
      deployedSceneJson = structuredClone(sceneJson);
      return { port: 3000, supportsDeployResource: false };
    });
  });

  afterEach(() => {
    setActiveSceneClient(null);
    vi.restoreAllMocks();
  });

  describe('when the deployment breaks the Place continuity and the user publishes anyway', () => {
    beforeEach(() => {
      vi.spyOn(Lands.prototype, 'fetchLandPublishedScenes').mockResolvedValue([
        { metadata: { scene: { base: '70,79', parcels: ['70,79', '70,80'] } } } as LandDeployment,
      ]);
    });

    it('should deploy a scene.json placed on the picked parcels, without a world', async () => {
      renderStep();
      const parcel = await screen.findByRole('button', { name: 'Parcel 70,80' });
      act(() => {
        fireEvent.mouseEnter(parcel);
      });
      act(() => {
        fireEvent.click(parcel);
      });
      await screen.findByText(/70,80/, {
        selector: '[data-testid="publish-modal-publish-to-land-placement"]',
      });
      fireEvent.click(screen.getByTestId('publish-modal-publish-to-land-action'));
      fireEvent.click(await screen.findByRole('button', { name: 'Publish anyway' }));

      await waitFor(() => expect(deployedSceneJson).toBeDefined());
      expect(onStep).toHaveBeenCalledWith('deploy');
      expect(deployedSceneJson?.scene).toEqual({ base: '70,80', parcels: ['70,80', '71,80'] });
      expect(deployedSceneJson?.worldConfiguration).toBeUndefined();
    });
  });

  describe('when a parcel other than the scene.json base is picked with the editor open', () => {
    it('should deploy a scene.json placed on the picked parcels, without a world', async () => {
      await pickParcel7080AndPublish();

      await waitFor(() => expect(deployedSceneJson).toBeDefined());
      expect(deployedSceneJson?.scene).toEqual({ base: '70,80', parcels: ['70,80', '71,80'] });
      expect(deployedSceneJson?.worldConfiguration).toBeUndefined();
    });

    it('should hand the placement to the editor before flushing it, and deploy last', async () => {
      await pickParcel7080AndPublish();

      await waitFor(() => expect(order.at(-1)).toBe('publish'));
      expect(order.indexOf('push')).toBeLessThan(order.indexOf('save'));
      expect(order.lastIndexOf('write')).toBeGreaterThan(order.indexOf('save'));
      expect(setSceneSettings).toHaveBeenCalledWith({
        layout: {
          base: { x: 70, y: 80 },
          parcels: [
            { x: 70, y: 80 },
            { x: 71, y: 80 },
          ],
        },
      });
    });

    it('should keep the picked placement in the store', async () => {
      await pickParcel7080AndPublish();

      expect(store.getState().editor.project?.scene).toEqual({
        base: '70,80',
        parcels: ['70,80', '71,80'],
      });
      expect(store.getState().editor.project?.worldConfiguration).toBeUndefined();
    });
  });

  describe('when the editor cannot save before publishing', () => {
    beforeEach(() => {
      saveScene.mockRejectedValue(new Error('EBUSY: resource busy or locked'));
    });

    it('should not deploy', async () => {
      await pickParcel7080AndPublish();

      await waitFor(() => expect(store.getState().editor.publishError).toContain('EBUSY'));
      expect(editor.publishScene).not.toHaveBeenCalled();
    });
  });
});
