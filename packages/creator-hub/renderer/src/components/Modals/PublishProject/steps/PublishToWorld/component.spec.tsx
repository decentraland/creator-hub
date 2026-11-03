import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import type { Project } from '/shared/types/projects';
import type { Props } from '/@/components/Modals/PublishProject/types';
import { ENSProvider } from '/@/modules/store/ens/types';
import { fetchENSList } from '/@/modules/store/ens';

import { createTestStore } from '../../../../../../tests/utils/testStore';
import { PublishToWorld } from './component';

const WALLET = '0xcollaborator';
const WORLD = 'shared-world.dcl.eth';

const api = vi.hoisted(() => ({
  fetchWorldSettings: vi.fn(),
  fetchWorldScenes: vi.fn(),
  fetchParcelsPermission: vi.fn(),
  getContentSrcUrl: (hash: string) => `https://content.example.org/${hash}`,
}));

vi.mock('/@/lib/worlds', async importOriginal => ({
  ...(await importOriginal<object>()),
  Worlds: class {
    constructor() {
      return api;
    }
  },
}));
vi.mock('#store', async () => {
  const redux = await import('react-redux');
  return { useDispatch: redux.useDispatch, useSelector: redux.useSelector };
});
vi.mock('/@/hooks/useAuth', () => ({ useAuth: () => ({ wallet: WALLET }) }));
vi.mock('/@/hooks/useEditor', () => ({
  useEditor: () => ({ project: PROJECT, publishScene: vi.fn() }),
}));
vi.mock('/@/hooks/useWorkspace', () => ({
  useWorkspace: () => ({ updateSceneJson: vi.fn(), updateProject: vi.fn() }),
}));
vi.mock('/@/modules/store/translation/utils', async importOriginal => ({
  ...(await importOriginal<object>()),
  t: (id: string) => id,
}));

/** The modal shell and the scene header read store slices and breakpoints this environment
 * does not populate; the behavior under test lives in the step body. */
vi.mock('/@/components/Modals/PublishProject/PublishModal', () => ({
  PublishModal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('/@/components/Modals/PublishProject/ProjectStepWrapper', () => ({
  ProjectStepWrapper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const PROJECT = {
  path: '/scenes/example',
  title: 'Example',
  thumbnail: '',
  status: 'idle',
  layout: { rows: 1, cols: 1 },
  scene: { parcels: ['0,0'], base: '0,0' },
  worldConfiguration: { name: WORLD },
} as unknown as Project;

const LOAD_ERROR = 'modal.publish_project.worlds.select_world.load_error';
const RETRY = 'modal.publish_project.worlds.select_world.actions.retry';
const SELECT_LOCATION = 'modal.publish_project.worlds.select_world.actions.select_location';

const OFFLINE = () => Promise.reject(new TypeError('Failed to fetch'));
const TWO_SCENES = { scenes: [{ parcels: ['0,0'] }, { parcels: ['1,0'] }], total: 2 };

describe('PublishToWorld', () => {
  let store: ReturnType<typeof createTestStore>;

  const mount = async () => {
    store = createTestStore();
    store.dispatch({
      type: fetchENSList.fulfilled.type,
      payload: [{ subdomain: WORLD, nftOwnerAddress: '0xowner', provider: ENSProvider.DCL }],
    });
    const props = { open: true, onBack: vi.fn(), onClose: vi.fn(), onStep: vi.fn() };
    await act(async () => {
      render(
        <Provider store={store}>
          <ThemeProvider theme={dark}>
            <PublishToWorld {...(props as unknown as Props)} />
          </ThemeProvider>
        </Provider>,
      );
    });
  };

  const goOnline = () => {
    api.fetchWorldSettings.mockResolvedValue({ title: 'Shared world' });
    api.fetchWorldScenes.mockResolvedValue(TWO_SCENES);
    api.fetchParcelsPermission.mockResolvedValue({ parcels: [], total: 0 });
  };

  beforeEach(() => {
    goOnline();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('when every request for the picked world fails', () => {
    beforeEach(async () => {
      api.fetchWorldSettings.mockImplementation(OFFLINE);
      api.fetchWorldScenes.mockResolvedValue(null);
      api.fetchParcelsPermission.mockImplementation(OFFLINE);
      await mount();
    });

    it('should show the load error with a Retry button', () => {
      expect(screen.getByText(LOAD_ERROR)).toBeTruthy();
      expect(screen.getByText(RETRY)).toBeTruthy();
    });

    describe('and Retry is pressed once the connection is back', () => {
      beforeEach(async () => {
        goOnline();
        await act(async () => {
          fireEvent.click(screen.getByText(RETRY));
        });
      });

      it('should reload the world settings and scenes, not only the parcel permissions', () => {
        expect(api.fetchWorldSettings).toHaveBeenCalledTimes(2);
        expect(api.fetchWorldScenes).toHaveBeenCalledTimes(2);
        expect(api.fetchParcelsPermission).toHaveBeenCalledTimes(2);
      });

      it('should clear the error and offer the same next step as picking the world', () => {
        expect(screen.queryByText(LOAD_ERROR)).toBeNull();
        expect(screen.getByText(SELECT_LOCATION)).toBeTruthy();
        expect(screen.getByText('Shared world')).toBeTruthy();
      });
    });
  });

  describe('when only the world settings fail to load', () => {
    beforeEach(async () => {
      api.fetchWorldSettings.mockImplementation(OFFLINE);
      await mount();
    });

    it('should still show the load error with a Retry button', () => {
      expect(screen.getByText(LOAD_ERROR)).toBeTruthy();
      expect(screen.getByText(RETRY)).toBeTruthy();
    });
  });

  describe('when only the world scenes fail to load', () => {
    beforeEach(async () => {
      api.fetchWorldScenes.mockResolvedValue(null);
      await mount();
    });

    it('should show the load error instead of treating the world as empty', () => {
      expect(screen.getByText(LOAD_ERROR)).toBeTruthy();
      expect(screen.getByText(RETRY)).toBeTruthy();
    });
  });

  describe('when everything loads', () => {
    beforeEach(async () => {
      await mount();
    });

    it('should not show the load error', () => {
      expect(screen.queryByText(LOAD_ERROR)).toBeNull();
      expect(screen.getByText(SELECT_LOCATION)).toBeTruthy();
    });
  });
});
