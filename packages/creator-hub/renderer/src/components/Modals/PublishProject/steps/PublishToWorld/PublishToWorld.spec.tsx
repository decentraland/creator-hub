import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { useAuth } from '/@/hooks/useAuth';
import { useEditor } from '/@/hooks/useEditor';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';
import type * as WorldsModule from '/@/lib/worlds';
import type { Project } from '/shared/types/projects';

import { createTestStore } from '../../../../../../tests/utils/testStore';
import { PublishToWorld } from '.';

const OWNER = '0x00000000000000000000000000000000000000a1';

vi.mock('/@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('/@/hooks/useEditor', () => ({ useEditor: vi.fn() }));
const api = vi.hoisted(() => ({
  fetchWorldSettings: vi.fn(),
  fetchWorldScenes: vi.fn(),
  fetchParcelsPermission: vi.fn(),
  getContentSrcUrl: (hash: string) => hash,
}));

vi.mock('/@/lib/worlds', async importOriginal => {
  const original = await importOriginal<typeof WorldsModule>();
  return {
    ...original,
    Worlds: class {
      constructor() {
        return api;
      }
    },
  };
});
vi.mock('../../PublishModal', () => ({
  PublishModal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../ProjectStepWrapper', () => ({
  ProjectStepWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('/@/hooks/useWorkspace', () => ({
  useWorkspace: () => ({ updateSceneJson: vi.fn(), updateProject: vi.fn() }),
}));

const project = {
  id: 'project-1',
  path: '/projects/fixture',
  title: 'Fixture Scene',
  thumbnail: '',
  layout: { rows: 1, cols: 1 },
  worldConfiguration: { name: 'plaza.dcl.eth' },
} as unknown as Project;

const COLLABORATOR = '0x00000000000000000000000000000000000000c1';

const LOAD_ERROR = "We couldn't load this world's details. Check your connection and try again.";
const OFFLINE = () => Promise.reject(new TypeError('Failed to fetch'));

function goOnline() {
  api.fetchWorldSettings.mockResolvedValue({ title: 'Plaza' });
  api.fetchWorldScenes.mockResolvedValue({ scenes: [], total: 0 });
  api.fetchParcelsPermission.mockResolvedValue({ parcels: [], total: 0 });
}

async function renderStep(wallet = OWNER) {
  vi.mocked(useAuth).mockReturnValue({ wallet } as unknown as ReturnType<typeof useAuth>);
  vi.mocked(useEditor).mockReturnValue({
    project,
    publishScene: vi.fn(),
  } as unknown as ReturnType<typeof useEditor>);
  const store = createTestStore();
  store.dispatch({ type: 'ens/fetchENSList/pending', meta: { requestId: 'r' } });
  store.dispatch({
    type: 'ens/fetchENSList/fulfilled',
    payload: [{ subdomain: 'plaza.dcl.eth', nftOwnerAddress: OWNER, provider: 'dcl' }],
    meta: { requestId: 'r' },
  });
  render(
    <Provider store={store as never}>
      <MemoryRouter>
        <ThemeProvider theme={dark}>
          <PublishToWorld
            open
            project={project}
            onClose={vi.fn()}
            onStep={vi.fn()}
          />
        </ThemeProvider>
      </MemoryRouter>
    </Provider>,
  );
  await act(async () => {});
}

describe('PublishToWorld', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  beforeEach(goOnline);

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('when the owner turns on multi-scene for one of their Worlds', () => {
    it('should offer no World settings shortcut', async () => {
      await renderStep();

      fireEvent.click(screen.getAllByRole('checkbox')[0]);
      await act(async () => {});

      expect(screen.getByText('Current World')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
    });
  });

  describe('when a collaborator picks a world and every request for it fails', () => {
    beforeEach(async () => {
      api.fetchWorldSettings.mockImplementation(OFFLINE);
      api.fetchWorldScenes.mockResolvedValue(null);
      api.fetchParcelsPermission.mockImplementation(OFFLINE);
      await renderStep(COLLABORATOR);
      await screen.findByText(LOAD_ERROR);
    });

    it('should show the load error with a Retry button', () => {
      expect(screen.getByText(LOAD_ERROR)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    });

    describe('and Retry is pressed once the connection is back', () => {
      let callsBefore: number[];
      const calls = () =>
        [api.fetchWorldSettings, api.fetchWorldScenes, api.fetchParcelsPermission].map(
          fn => fn.mock.calls.length,
        );

      beforeEach(async () => {
        callsBefore = calls();
        goOnline();
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        await waitFor(() => expect(screen.queryByText(LOAD_ERROR)).toBeNull());
      });

      it('should reload the world settings and scenes, not only the parcel permissions', () => {
        calls().forEach((count, index) => expect(count).toBeGreaterThan(callsBefore[index]));
      });

      it('should clear the error and offer the next step', () => {
        expect(
          screen.getByTestId('publish-modal-publish-to-world-select-world-action'),
        ).toHaveProperty('disabled', false);
      });
    });
  });

  describe('when only the world settings fail to load', () => {
    beforeEach(async () => {
      api.fetchWorldSettings.mockImplementation(OFFLINE);
      await renderStep();
    });

    it('should show the load error and block the next step', () => {
      expect(screen.getByText(LOAD_ERROR)).toBeTruthy();
      expect(
        screen.getByTestId('publish-modal-publish-to-world-select-world-action'),
      ).toHaveProperty('disabled', true);
    });
  });

  describe('when only the world scenes fail to load', () => {
    beforeEach(async () => {
      api.fetchWorldScenes.mockResolvedValue(null);
      await renderStep();
    });

    it('should show the load error instead of treating the world as empty', async () => {
      expect(await screen.findByText(LOAD_ERROR)).toBeTruthy();
    });
  });

  describe('when everything loads', () => {
    beforeEach(async () => {
      await renderStep();
    });

    it('should not show the load error', () => {
      expect(screen.queryByText(LOAD_ERROR)).toBeNull();
    });
  });
});
