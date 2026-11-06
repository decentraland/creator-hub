import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import type { Project } from '/shared/types/projects';

import { fs, workspace } from '#preload';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';
import { actions as workspaceActions } from '/@/modules/store/workspace';
import * as api from '/@/lib/creatorFundApi';
import * as metricsApi from '/@/lib/metricsApi';
import { Lands, type LandDeployment } from '/@/lib/land';
import type * as LandModule from '/@/lib/land';
import { Worlds } from '/@/lib/worlds';

import { createTestStore } from '../../../../tests/utils/testStore';
import {
  CYCLES,
  LATEST_CLOSED,
  OLDEST_CLOSED,
  RUNNING,
  exampleWorld,
  fail,
  metricsBatch,
  myPlaces,
  ok,
  place,
} from './fixtures';
import { MyPlacesTab } from './MyPlacesTab';

vi.mock('/@/lib/creatorFundApi', () => ({
  getCycles: vi.fn(),
  getPlaces: vi.fn(),
}));
vi.mock('/@/lib/metricsApi', () => ({ fetchMetrics: vi.fn() }));
vi.mock('/@/lib/worlds', () => ({ Worlds: vi.fn() }));
vi.mock('/@/lib/land', async importOriginal => ({
  ...(await importOriginal<typeof LandModule>()),
  Lands: vi.fn(),
}));
Worlds.prototype.fetchWorldScenes = vi.fn();
Lands.prototype.fetchLandPublishedScenes = vi.fn();

const localProject = (title: string, overrides: Partial<Project> = {}) =>
  ({
    id: title,
    path: `/scenes/${title}`,
    title,
    thumbnail: '',
    scene: { base: '0,0', parcels: ['0,0', '0,1'] },
    createdAt: 1,
    updatedAt: 1,
    publishedAt: 0,
    info: { id: title, skipPublishWarning: false },
    ...overrides,
  }) as Project;

const publishedOnLand = (title: string, deploymentHash: string, updatedAt: number) =>
  localProject(title, {
    updatedAt,
    info: {
      id: title,
      skipPublishWarning: false,
      deployments: { 'land:1,1': { publishedAt: 1, deploymentHash, parcel: '1,1' } },
    },
  });

const renderTab = ({ projects = [] as Project[] | 'loading' } = {}) => {
  const store = createTestStore();
  if (projects !== 'loading') {
    const { settings, sortBy } = store.getState().workspace;
    store.dispatch(
      workspaceActions.getWorkspace.fulfilled({ settings, sortBy, projects, missing: [] }, ''),
    );
  }
  const view = render(
    <Provider store={store}>
      <ThemeProvider theme={dark}>
        <MemoryRouter initialEntries={['/earn']}>
          <Routes>
            <Route
              path="/earn"
              element={<MyPlacesTab />}
            />
            <Route
              path="/editor"
              element={<h1>Editor</h1>}
            />
            <Route
              path="/templates"
              element={<h1>Templates</h1>}
            />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </Provider>,
  );
  return { store, ...view };
};

async function chooseCycle(name: string) {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Cycle' }));
  fireEvent.click(await screen.findByRole('option', { name }));
}

const PLACES = [
  place('a'),
  exampleWorld('b', { status: 'not_eligible', reasons: ['content_policy'] }),
];

describe('MyPlacesTab', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  beforeEach(() => {
    vi.mocked(api.getCycles).mockResolvedValue(ok(CYCLES));
    vi.mocked(api.getPlaces).mockResolvedValue(ok(myPlaces(PLACES)));
    vi.mocked(metricsApi.fetchMetrics).mockImplementation(async locations =>
      metricsBatch(locations.map((_, index) => place(String(index)))),
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('when it opens', () => {
    it('should load the running cycle with the metrics export time', async () => {
      renderTab();

      expect(await screen.findByRole('article', { name: 'Example Place a' })).toBeTruthy();
      expect(api.getPlaces).toHaveBeenCalledWith(RUNNING.id);
      expect(screen.getByRole('combobox', { name: 'Cycle' }).textContent).toBe('Current cycle');
      expect((await screen.findByText(/^Last update /)).textContent).toMatch(
        /^Last update \d{1,2}:\d{2}\s[AP]M$/,
      );
      expect(
        screen.getByRole('toolbar', {
          name: 'Performance of your Places participating in the program',
        }),
      ).toBeTruthy();
      expect(screen.getByRole('heading', { level: 2, name: 'Example Place a' })).toBeTruthy();
    });

    it('should mark only the selected cycle with a check, and keep the check out of the closed value', async () => {
      renderTab();
      await screen.findByRole('article', { name: 'Example Place a' });

      const combobox = screen.getByRole('combobox', { name: 'Cycle' });
      expect(combobox.querySelector('svg')).toBeNull();
      fireEvent.mouseDown(combobox);

      const options = await screen.findAllByRole('option');
      const marked = options.filter(option => option.querySelector('svg'));
      expect(marked.map(option => option.textContent)).toEqual(['Current cycle']);
      expect(marked[0].getAttribute('aria-selected')).toBe('true');
    });

    it('should offer Current cycle first, then the closed cycles newest first, never an upcoming one', async () => {
      renderTab();
      await screen.findByRole('article', { name: 'Example Place a' });

      fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Cycle' }));

      expect((await screen.findAllByRole('option')).map(option => option.textContent)).toEqual([
        'Current cycle',
        'Oct 16 - Oct 31, 2026',
        'Oct 1 - Oct 15, 2026',
      ]);
    });

    it('should ask the analytics API for the places by base position or world', async () => {
      renderTab();
      await screen.findByRole('article', { name: 'Example Place a' });

      await waitFor(() =>
        expect(metricsApi.fetchMetrics).toHaveBeenCalledWith([
          { x: 5, y: 7 },
          { world: 'example-world.dcl.eth', x: 0, y: 0 },
        ]),
      );
    });
  });

  describe.each([['closed', 'Oct 1 - Oct 15, 2026', () => OLDEST_CLOSED]])(
    'when a %s cycle is chosen',
    (_status, label, target) => {
      it('should list the places with no metric cards, no metrics request and no last update', async () => {
        vi.mocked(api.getPlaces).mockImplementation(async cycle =>
          ok(myPlaces(PLACES, cycle === target().id ? target() : RUNNING)),
        );
        renderTab();
        await screen.findByText(/^Last update /);
        vi.mocked(metricsApi.fetchMetrics).mockClear();

        await chooseCycle(label);

        await waitFor(() => expect(api.getPlaces).toHaveBeenLastCalledWith(target().id));
        const entry = await screen.findByRole('article', { name: 'Example Place a' });
        expect(within(entry).getByText('In program')).toBeTruthy();
        expect(within(entry).getByText('5,7')).toBeTruthy();
        expect(within(entry).queryByText('New Players Attributable')).toBeNull();
        expect(entry.querySelector('dl')).toBeNull();
        expect(metricsApi.fetchMetrics).not.toHaveBeenCalled();
        expect(screen.queryByText(/^Last update /)).toBeNull();
      });
    },
  );

  describe.each([
    ['only closed cycles exist', ['closed']],
    ['no cycle runs but one is upcoming', ['closed', 'upcoming']],
  ])('when %s', (_name, statuses) => {
    it('should ask for the latest closed cycle by id', async () => {
      vi.mocked(api.getCycles).mockResolvedValue(
        ok({ cycles: CYCLES.cycles.filter(cycle => statuses.includes(cycle.status)) }),
      );
      renderTab();

      await waitFor(() => expect(api.getPlaces).toHaveBeenCalledWith(LATEST_CLOSED.id));
      expect(screen.getByRole('combobox', { name: 'Cycle' }).textContent).toBe(
        'Oct 16 - Oct 31, 2026',
      );
    });
  });

  describe('when only an upcoming cycle exists, before launch', () => {
    const UPCOMING = CYCLES.cycles.find(cycle => cycle.status === 'upcoming')!;

    beforeEach(() => {
      vi.mocked(api.getCycles).mockResolvedValue(ok({ cycles: [UPCOMING] }));
      vi.mocked(api.getPlaces).mockResolvedValue(ok(myPlaces(PLACES, UPCOMING)));
    });

    it("should show the upcoming cycle's places under Current cycle, with no metrics", async () => {
      renderTab();

      expect(await screen.findByRole('article', { name: 'Example Place a' })).toBeTruthy();
      expect(api.getPlaces).toHaveBeenCalledWith(undefined);
      const combobox = screen.getByRole('combobox', { name: 'Cycle' });
      expect(combobox.textContent).toBe('Current cycle');
      expect(metricsApi.fetchMetrics).not.toHaveBeenCalled();
      expect(screen.queryByText(/^Last update /)).toBeNull();
      fireEvent.mouseDown(combobox);
      expect((await screen.findAllByRole('option')).map(option => option.textContent)).toEqual([
        'Current cycle',
      ]);
    });
  });

  describe('when no cycle exists', () => {
    it('should offer to create the first scene with no filter bar, asking for no places', async () => {
      vi.mocked(api.getCycles).mockResolvedValue(ok({ cycles: [] }));
      const { container } = renderTab();

      expect(
        await within(container).findByRole('heading', {
          name: 'Create your first scene to start earning',
        }),
      ).toBeTruthy();
      expect(within(container).queryByRole('toolbar')).toBeNull();
      expect(api.getPlaces).not.toHaveBeenCalled();
    });
  });

  describe('when the Cycle list opens', () => {
    const paper = () => screen.getByRole('listbox').closest('.MuiPaper-root')!;

    it('should mark the list as keyboard-driven only when a key opened it', async () => {
      renderTab();
      await screen.findByRole('article', { name: 'Example Place a' });
      const combobox = screen.getByRole('combobox', { name: 'Cycle' });

      fireEvent.pointerDown(combobox);
      fireEvent.mouseDown(combobox);
      await screen.findByRole('listbox');
      expect(paper().getAttribute('data-keyboard')).toBeNull();
      fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());

      fireEvent.keyDown(combobox, { key: 'ArrowDown' });
      await screen.findByRole('listbox');
      expect(paper().getAttribute('data-keyboard')).toBe('true');
    });
  });

  describe('when a place is in a World', () => {
    const inWorld = exampleWorld('w', { base_position: '2,1' });

    beforeEach(() => {
      vi.mocked(api.getPlaces).mockResolvedValue(ok(myPlaces([inWorld])));
    });

    it('should label a World of several scenes with the scene position', async () => {
      vi.mocked(Worlds.prototype.fetchWorldScenes).mockResolvedValue({
        scenes: [],
        total: 3,
      } as any);
      renderTab();

      const entry = await screen.findByRole('article', { name: 'Example World w' });
      expect(await within(entry).findByText('example-world.dcl.eth - 2,1')).toBeTruthy();
      expect(Worlds.prototype.fetchWorldScenes).toHaveBeenCalledTimes(1);
    });

    it('should label a single-scene World by its name alone', async () => {
      vi.mocked(Worlds.prototype.fetchWorldScenes).mockResolvedValue({
        scenes: [],
        total: 1,
      } as any);
      renderTab();

      const entry = await screen.findByRole('article', { name: 'Example World w' });
      await waitFor(() => expect(Worlds.prototype.fetchWorldScenes).toHaveBeenCalled());
      expect(within(entry).getByText('example-world.dcl.eth')).toBeTruthy();
    });

    it('should keep the name alone while the count is unknown', async () => {
      vi.mocked(Worlds.prototype.fetchWorldScenes).mockReturnValue(new Promise(() => {}));
      renderTab();

      const entry = await screen.findByRole('article', { name: 'Example World w' });
      expect(within(entry).getByText('example-world.dcl.eth')).toBeTruthy();
    });
  });

  describe('when a place is in the program', () => {
    it('should chip it and format its three metrics', async () => {
      renderTab();

      const entry = await screen.findByRole('article', { name: 'Example Place a' });
      expect(within(entry).getByText('In program')).toBeTruthy();
      expect(within(entry).getByText('5,7')).toBeTruthy();
      expect(await within(entry).findByText('1,234')).toBeTruthy();
      expect(within(entry).getByText('10.2%')).toBeTruthy();
      expect(within(entry).getByText('128 min')).toBeTruthy();
      expect(within(entry).getByText('New Players Attributable')).toBeTruthy();
      expect(within(entry).queryByText('Ranking Position')).toBeNull();
    });

    it('should show "-" named "No data" for a missing metric', async () => {
      vi.mocked(metricsApi.fetchMetrics).mockResolvedValue(
        metricsBatch(PLACES, { new_decentraland_players_30d: 3 }),
      );
      renderTab();

      const entry = await screen.findByRole('article', { name: 'Example Place a' });
      await within(entry).findByText('3');
      const missing = within(entry).getAllByText('No data');
      expect(missing).toHaveLength(2);
      expect(missing.every(value => value.previousElementSibling?.textContent === '-')).toBe(true);
      expect(
        missing.every(
          value => value.previousElementSibling?.getAttribute('aria-hidden') === 'true',
        ),
      ).toBe(true);
    });

    it('should hold every metric in a busy placeholder named "Loading" while the metrics load', async () => {
      vi.mocked(metricsApi.fetchMetrics).mockReturnValue(new Promise(() => {}));
      renderTab();

      const entry = await screen.findByRole('article', { name: 'Example Place a' });
      const loading = within(entry).getAllByText('Loading');
      expect(loading).toHaveLength(3);
      expect(
        loading.every(label => label.closest('dd')?.getAttribute('aria-busy') === 'true'),
      ).toBe(true);
      expect(within(entry).queryByText('-')).toBeNull();
      expect(within(entry).queryByText('No data')).toBeNull();
    });

    it('should show "-" for every metric when the metrics fail', async () => {
      vi.mocked(metricsApi.fetchMetrics).mockRejectedValue(new Error('down'));
      renderTab();

      const entry = await screen.findByRole('article', { name: 'Example Place a' });
      await waitFor(() => expect(within(entry).getAllByText('No data')).toHaveLength(3));
      expect(screen.queryByText(/^Last update /)).toBeNull();
    });
  });

  describe('when a place is eligible', () => {
    it('should chip it as in the program, never as not eligible', async () => {
      vi.mocked(api.getPlaces).mockResolvedValue(
        ok(myPlaces([place('a', { status: 'eligible' })])),
      );
      renderTab();

      const entry = await screen.findByRole('article', { name: 'Example Place a' });
      expect(within(entry).getByText('In program')).toBeTruthy();
      expect(within(entry).queryByText('Not eligible')).toBeNull();
    });
  });

  describe('when a place is not eligible', () => {
    it.each([
      ['content_policy', "This scene doesn't meet the Content Policy."],
      ['excluded', 'This scene is excluded from the Creator Fund.'],
      ['not_owner', "Only the owner earns from this place. You're a collaborator."],
      ['creator_not_eligible', "Your account isn't eligible, so this place can't take part."],
      ['terms_outdated', 'Accept the updated Program Terms to take part.'],
      ['a_new_code', "This scene can't take part right now."],
    ])('should explain %s in the chip tooltip, with no stats', async (reason, copy) => {
      vi.mocked(api.getPlaces).mockResolvedValue(
        ok(myPlaces([exampleWorld('b', { status: 'not_eligible', reasons: [reason] })])),
      );
      renderTab();

      const entry = await screen.findByRole('article', { name: 'Example World b' });
      const chip = within(entry).getByText('Not eligible').closest('[tabindex="0"]') as HTMLElement;
      expect(within(entry).queryByText('D3 Retention')).toBeNull();

      fireEvent.mouseOver(chip);

      expect((await screen.findByRole('tooltip')).textContent).toBe(copy);
    });

    it('should list every reason on its own line', async () => {
      vi.mocked(api.getPlaces).mockResolvedValue(
        ok(
          myPlaces([
            exampleWorld('b', { status: 'not_eligible', reasons: ['content_policy', 'excluded'] }),
          ]),
        ),
      );
      renderTab();

      const entry = await screen.findByRole('article', { name: 'Example World b' });
      fireEvent.mouseOver(within(entry).getByText('Not eligible'));

      const tooltip = await screen.findByRole('tooltip');
      expect(within(tooltip).getByText("This scene doesn't meet the Content Policy.")).toBeTruthy();
      expect(
        within(tooltip).getByText('This scene is excluded from the Creator Fund.'),
      ).toBeTruthy();
    });
  });

  describe('when a place was replaced', () => {
    it('should chip it as replaced, explain why and keep its stats', async () => {
      vi.mocked(api.getPlaces).mockResolvedValue(
        ok(myPlaces([place('r', { status: 'replaced' })])),
      );
      renderTab();

      const entry = await screen.findByRole('article', { name: 'Example Place r' });
      expect(await within(entry).findByText('1,234')).toBeTruthy();
      fireEvent.mouseOver(within(entry).getByText('Replaced'));

      expect((await screen.findByRole('tooltip')).textContent).toBe(
        'This place was republished as a new one. Its earlier numbers are kept.',
      );
      expect(within(entry).getByText('Replaced').getAttribute('aria-label')).toBeNull();
      expect(within(entry).getByText('Replaced').getAttribute('aria-describedby')).toBeTruthy();
    });
  });

  describe('when the places come in mixed statuses', () => {
    const MIXED = [
      place('x', { status: 'not_eligible', reasons: ['excluded'] }),
      place('a'),
      place('r', { status: 'replaced' }),
      place('e', { status: 'eligible' }),
      place('b'),
    ];
    const ORDER = [
      'Example Place a',
      'Example Place e',
      'Example Place b',
      'Example Place x',
      'Example Place r',
    ];

    const names = (container: HTMLElement) =>
      within(container)
        .getAllByRole('article')
        .map(entry => entry.getAttribute('aria-labelledby'))
        .map(id => container.ownerDocument.getElementById(id!)!.textContent);

    it('should list the places chipped "In program" first, keeping the server order within each group', async () => {
      vi.mocked(api.getPlaces).mockResolvedValue(ok(myPlaces(MIXED)));
      const { container } = renderTab();

      await within(container).findByRole('article', { name: 'Example Place a' });

      expect(names(container)).toEqual(ORDER);
    });

    it('should order a closed cycle the same way', async () => {
      vi.mocked(api.getPlaces).mockImplementation(async cycle =>
        ok(cycle === OLDEST_CLOSED.id ? myPlaces(MIXED, OLDEST_CLOSED) : myPlaces(PLACES)),
      );
      const { container } = renderTab();
      await within(container).findByRole('article', { name: 'Example Place a' });

      await chooseCycle('Oct 1 - Oct 15, 2026');

      await within(container).findByRole('article', { name: 'Example Place r' });
      expect(names(container)).toEqual(ORDER);
    });
  });

  describe('when a place has no title', () => {
    it('should name it by its location', async () => {
      vi.mocked(api.getPlaces).mockResolvedValue(
        ok(myPlaces([place('u', { title: null, base_position: '12,-3' })])),
      );
      renderTab();

      expect(await screen.findByRole('article', { name: '12,-3' })).toBeTruthy();
    });
  });

  describe('when there are no places in the current cycle', () => {
    beforeEach(() => {
      vi.mocked(api.getPlaces).mockResolvedValue(ok(myPlaces([])));
    });

    describe('and there are no local scenes', () => {
      it('should offer to create the first scene, and not ask for metrics', async () => {
        const { container } = renderTab();

        expect(
          await within(container).findByRole('heading', {
            name: 'Create your first scene to start earning',
          }),
        ).toBeTruthy();
        expect(
          within(container).getByText(
            'Once you publish a scene, it shows up here with its performance for the current cycle.',
          ),
        ).toBeTruthy();
        expect(metricsApi.fetchMetrics).not.toHaveBeenCalled();
      });

      it('should create a scene with the default name and open the editor, with no name modal', async () => {
        vi.mocked(workspace.createProject).mockResolvedValue({ path: '/scenes/New Scene' });
        const { container } = renderTab();

        fireEvent.click(await within(container).findByRole('button', { name: 'Create a scene' }));

        expect(await within(container).findByRole('heading', { name: 'Editor' })).toBeTruthy();
        expect(workspace.createProject).toHaveBeenCalledWith({});
        expect(screen.queryByRole('dialog')).toBeNull();
      });

      it('should open the templates catalog from Start from a template', async () => {
        const { container } = renderTab();

        fireEvent.click(
          await within(container).findByRole('button', { name: 'Start from a template' }),
        );

        expect(await within(container).findByRole('heading', { name: 'Templates' })).toBeTruthy();
        expect(workspace.createProject).not.toHaveBeenCalled();
      });
    });

    describe('and there are local scenes', () => {
      const PROJECTS = [
        localProject('Scene Old', { updatedAt: 10 }),
        publishedOnLand('Scene Live', 'bafy-live', 90),
        localProject('Scene Newest', { updatedAt: 80 }),
        localProject('Scene Middle', { updatedAt: 50 }),
        localProject('Scene Newer', { updatedAt: 70 }),
      ];

      beforeEach(() => {
        vi.mocked(Lands.prototype.fetchLandPublishedScenes).mockResolvedValue([
          { id: 'bafy-live' } as LandDeployment,
        ]);
      });

      it('should list the three newest scenes the content servers do not hold, newest edit first', async () => {
        const { container } = renderTab({ projects: PROJECTS });

        expect(
          await within(container).findByRole('heading', {
            name: 'Publish a scene to start earning',
          }),
        ).toBeTruthy();
        const section = within(container).getByRole('region', { name: 'Your unpublished scenes' });
        expect(within(section).getAllByRole('button')).toHaveLength(3);
        expect(
          within(section)
            .getAllByText(/^Scene /)
            .map(name => name.textContent),
        ).toEqual(['Scene Newest', 'Scene Newer', 'Scene Middle']);
        expect(within(section).getByRole('button', { name: 'Scene Newest' })).toBeTruthy();
        expect(within(section).getAllByText('2 Parcels')).toHaveLength(3);
      });

      it('should open a scene in the editor when its card is clicked', async () => {
        vi.mocked(fs.exists).mockResolvedValue(true);
        vi.mocked(workspace.hasNodeModules).mockReturnValue(new Promise(() => {}));
        const { container, store } = renderTab({ projects: PROJECTS });

        fireEvent.click(await within(container).findByRole('button', { name: 'Scene Newer' }));

        expect(await within(container).findByRole('heading', { name: 'Editor' })).toBeTruthy();
        expect(store.getState().editor.openingProjectPath).toBe('/scenes/Scene Newer');
      });

      it('should count a scene whose recorded deployment was replaced as unpublished', async () => {
        const { container } = renderTab({
          projects: [publishedOnLand('Scene Replaced', 'bafy-old', 90)],
        });

        const section = await within(container).findByRole('region', {
          name: 'Your unpublished scenes',
        });
        expect(within(section).getByRole('button', { name: 'Scene Replaced' })).toBeTruthy();
      });

      it('should show the publish prompt without the unpublished section when every scene is published', async () => {
        const { container } = renderTab({
          projects: [publishedOnLand('Scene Live', 'bafy-live', 90)],
        });

        expect(
          await within(container).findByRole('heading', {
            name: 'Publish a scene to start earning',
          }),
        ).toBeTruthy();
        expect(
          within(container).queryByRole('region', { name: 'Your unpublished scenes' }),
        ).toBeNull();
      });
    });

    describe('and the local scenes are still loading', () => {
      it('should show the loading spinner', async () => {
        const { container, store } = renderTab({ projects: 'loading' });

        await waitFor(() => expect(store.getState().creatorFund.places.status).toBe('succeeded'));
        expect(within(container).getByRole('progressbar', { name: 'Loading' })).toBeTruthy();
        expect(within(container).queryByRole('heading')).toBeNull();
      });
    });

    describe('and a cycle has closed', () => {
      it('should keep the filter bar above the empty state', async () => {
        const { container } = renderTab();

        await within(container).findByRole('heading', {
          name: 'Create your first scene to start earning',
        });
        expect(within(container).getByRole('combobox', { name: 'Cycle' })).toBeTruthy();
      });
    });

    describe('and no cycle has closed yet', () => {
      it('should hide the filter bar', async () => {
        vi.mocked(api.getCycles).mockResolvedValue(ok({ cycles: [RUNNING] }));
        const { container } = renderTab();

        await within(container).findByRole('heading', {
          name: 'Create your first scene to start earning',
        });
        expect(within(container).queryByRole('toolbar')).toBeNull();
      });
    });
  });

  describe('when there are no places in a closed cycle', () => {
    it('should say the cycle had none', async () => {
      vi.mocked(api.getPlaces).mockImplementation(async cycle =>
        ok(cycle === OLDEST_CLOSED.id ? myPlaces([], OLDEST_CLOSED) : myPlaces(PLACES)),
      );
      renderTab();
      await screen.findByRole('article', { name: 'Example Place a' });

      await chooseCycle('Oct 1 - Oct 15, 2026');

      expect((await screen.findByRole('status')).textContent).toBe('No places in this cycle.');
    });
  });

  describe('when the places fail to load', () => {
    it('should say so and retry', async () => {
      vi.mocked(api.getPlaces).mockResolvedValueOnce(fail());
      renderTab();

      expect((await screen.findByRole('alert')).textContent).toBe(
        'Something went wrong while loading your places.',
      );
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

      expect(await screen.findByRole('article', { name: 'Example Place a' })).toBeTruthy();
    });
  });

  describe('when the cycles fail to load', () => {
    it('should say so and retry the cycles', async () => {
      vi.mocked(api.getCycles).mockResolvedValueOnce(fail());
      renderTab();

      expect((await screen.findByRole('alert')).textContent).toBe(
        'Something went wrong while loading your places.',
      );
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

      expect(await screen.findByRole('article', { name: 'Example Place a' })).toBeTruthy();
    });
  });
});
