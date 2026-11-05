import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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
vi.mock('/@/lib/worlds', async importOriginal => {
  const original = await importOriginal<typeof WorldsModule>();
  return {
    ...original,
    Worlds: class {
      fetchWorldSettings = async () => ({ title: 'Plaza' });
      fetchWorldScenes = async () => ({ scenes: [], total: 0 });
      fetchParcelsPermission = async () => ({ parcels: [], total: 0 });
      getContentSrcUrl = (hash: string) => hash;
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

async function renderStep() {
  vi.mocked(useAuth).mockReturnValue({ wallet: OWNER } as unknown as ReturnType<typeof useAuth>);
  vi.mocked(useEditor).mockReturnValue({
    project,
    publishScene: vi.fn(),
  } as unknown as ReturnType<typeof useEditor>);
  const store = createTestStore();
  store.dispatch({
    type: 'ens/fetchENSList/fulfilled',
    payload: [{ subdomain: 'plaza.dcl.eth', nftOwnerAddress: OWNER, provider: 'dcl' }],
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

  afterEach(cleanup);

  describe('when the owner turns on multi-scene for one of their Worlds', () => {
    it('should offer no World settings shortcut', async () => {
      await renderStep();

      fireEvent.click(screen.getAllByRole('checkbox')[0]);
      await act(async () => {});

      expect(screen.getByText('Current World')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
    });
  });
});
