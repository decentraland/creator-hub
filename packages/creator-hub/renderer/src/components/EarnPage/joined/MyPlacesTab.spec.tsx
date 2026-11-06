import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import type { Project } from '/shared/types/projects';

import { analytics, fs, workspace } from '#preload';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';
import { actions as workspaceActions } from '/@/modules/store/workspace';
import * as api from '/@/lib/creatorFundApi';
import * as metricsApi from '/@/lib/metricsApi';
import { Lands, type LandDeployment } from '/@/lib/land';
import type * as LandModule from '/@/lib/land';
import { Worlds } from '/@/lib/worlds';

import { createTestStore } from '../../../../tests/utils/testStore';
import { watchFor } from '../../../../tests/utils/watchFor';
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
  const view = mountTab(store);
  return { store, ...view };
};

function mountTab(store: ReturnType<typeof createTestStore>) {
  return render(
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
}

const ALERT = '[role="alert"]';
const ENTRIES = 'article';
const METRIC_LOADING = '[aria-busy="true"]';
const NO_DATA = (element: Element) =>
  element.childElementCount === 0 && element.textContent === 'No data';

async function chooseCycle(name: string) {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Cycle' }));
  fireEvent.click(await screen.findByRole('option', { name }));
}

const PLACES = [
  place('a'),
  exampleWorld('b', { status: 'not_eligible', reasons: ['content_policy'] }),
];

const tooltipOf = (button: HTMLElement) =>
  button.ownerDocument.getElementById(button.getAttribute('aria-describedby') ?? '');

const expectTooltip = (button: HTMLElement, copy: string) =>
  waitFor(() => expect(tooltipOf(button)?.textContent).toBe(copy));

vi.setConfig({ testTimeout: 15_000 });

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
      expect((await screen.findByText(/^Last updated /)).textContent).toMatch(
        /^Last updated \d{1,2}:\d{2}\s[AP]M$/,
      );
      expect(
        screen.getByRole('toolbar', {
          name: 'Performance of your places in the program',
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
        await screen.findByText(/^Last updated /);
        vi.mocked(metricsApi.fetchMetrics).mockClear();

        await chooseCycle(label);

        await waitFor(() => expect(api.getPlaces).toHaveBeenLastCalledWith(target().id));
        const entry = await screen.findByRole('article', { name: 'Example Place a' });
        expect(within(entry).getByText('In program')).toBeTruthy();
        expect(within(entry).getByText('5,7')).toBeTruthy();
        expect(within(entry).queryByText('New Players Attributable')).toBeNull();
        expect(entry.querySelector('dl')).toBeNull();
        expect(metricsApi.fetchMetrics).not.toHaveBeenCalled();
        expect(screen.queryByText(/^Last updated /)).toBeNull();
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
      expect(screen.queryByText(/^Last updated /)).toBeNull();
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

    it('should explain D3 Retention in a tooltip when its info button is hovered', async () => {
      const { container } = renderTab();
      const info = await within(container).findByLabelText('About D3 Retention');

      fireEvent.mouseOver(info);

      await expectTooltip(
        info,
        'The percentage of new users who returned to your place within 3 days of their first visit.',
      );
    });

    it('should explain Total Playtime in a tooltip when its info button gets keyboard focus', async () => {
      const { container } = renderTab();
      const info = await within(container).findByLabelText('About Total Playtime');
      const matches = Element.prototype.matches;
      const keyboardFocus = vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
        this: Element,
        selector: string,
      ) {
        return selector === ':focus-visible' || matches.call(this, selector);
      });

      try {
        act(() => info.focus());

        await expectTooltip(
          info,
          'Average time each player spent in your place over the last 30 days.',
        );
      } finally {
        keyboardFocus.mockRestore();
      }
    });

    it('should explain New Players Attributable in a tooltip when its info button is hovered', async () => {
      const { container } = renderTab();
      const info = await within(container).findByLabelText('About New Players Attributable');

      fireEvent.mouseOver(info);

      await expectTooltip(
        info,
        'Wallets new to Decentraland whose first day was spent mostly in your place, over the last 30 days.',
      );
    });

    it('should give each of the three metrics one info button', async () => {
      const { container } = renderTab();
      await within(container).findByLabelText('About D3 Retention');

      const buttons = within(container).getAllByLabelText(/^About /);
      expect(buttons.map(button => button.getAttribute('aria-label'))).toEqual([
        'About New Players Attributable',
        'About D3 Retention',
        'About Total Playtime',
      ]);
      expect(buttons.every(button => button.tagName === 'BUTTON')).toBe(true);
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
      expect(screen.queryByText(/^Last updated /)).toBeNull();
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

  describe('when the first load ends with the places failed', () => {
    it('should go from the spinner to the error block, never showing a place', async () => {
      vi.mocked(api.getPlaces).mockResolvedValue(fail(404));
      const entries = watchFor(ENTRIES);

      try {
        renderTab();

        expect((await screen.findByRole('alert')).textContent).toBe(
          'Something went wrong while loading your places.',
        );
        expect(entries.seen()).toBe(false);
      } finally {
        entries.stop();
      }
    });
  });

  describe('when the tab mounts again after its places failed', () => {
    it('should show only the spinner while they load again, never the earlier error', async () => {
      vi.mocked(api.getPlaces).mockResolvedValue(fail(404));
      const { store } = renderTab();
      await screen.findByRole('alert');
      cleanup();
      vi.mocked(api.getPlaces).mockReturnValue(new Promise(() => {}));
      const error = watchFor(ALERT);

      try {
        mountTab(store);

        expect(screen.getByRole('progressbar', { name: 'Loading' })).toBeTruthy();
        expect(error.seen()).toBe(false);
      } finally {
        error.stop();
      }
    });

    it('should go from the spinner to the error block when they fail again', async () => {
      vi.mocked(api.getPlaces).mockResolvedValue(fail(404));
      const { store } = renderTab();
      await screen.findByRole('alert');
      cleanup();
      const entries = watchFor(ENTRIES);

      try {
        mountTab(store);

        expect(screen.getByRole('progressbar', { name: 'Loading' })).toBeTruthy();
        expect((await screen.findByRole('alert')).textContent).toBe(
          'Something went wrong while loading your places.',
        );
        expect(entries.seen()).toBe(false);
      } finally {
        entries.stop();
      }
    });
  });

  describe('when the tab mounts again after everything loaded', () => {
    it('should show the places and their metrics at once and refetch them quietly', async () => {
      const { store } = renderTab();
      await screen.findAllByText('1,234');
      cleanup();
      vi.mocked(api.getPlaces).mockClear();
      vi.mocked(metricsApi.fetchMetrics).mockClear();
      const loading = watchFor(METRIC_LOADING);

      try {
        mountTab(store);

        expect(screen.getByRole('article', { name: 'Example Place a' })).toBeTruthy();
        expect(screen.getAllByText('1,234').length).toBeGreaterThan(0);
        await waitFor(() => expect(metricsApi.fetchMetrics).toHaveBeenCalled());
        await waitFor(() =>
          expect(store.getState().creatorFund.placeMetrics.status).toBe('succeeded'),
        );
        expect(api.getPlaces).toHaveBeenCalledTimes(1);
        expect(screen.getAllByText('1,234').length).toBeGreaterThan(0);
        expect(loading.seen()).toBe(false);
      } finally {
        loading.stop();
      }
    });
  });

  describe('when the tab mounts again after the metrics failed', () => {
    it('should hold the metrics as loading while they load again, never "No data"', async () => {
      vi.mocked(metricsApi.fetchMetrics).mockRejectedValue(new Error('down'));
      const { store } = renderTab();
      const entry = await screen.findByRole('article', { name: 'Example Place a' });
      await waitFor(() => expect(within(entry).getAllByText('No data')).toHaveLength(3));
      cleanup();
      vi.mocked(metricsApi.fetchMetrics).mockReturnValue(new Promise(() => {}));
      const noData = watchFor(NO_DATA);

      try {
        mountTab(store);

        const again = screen.getByRole('article', { name: 'Example Place a' });
        expect(within(again).getAllByText('Loading')).toHaveLength(3);
        expect(noData.seen()).toBe(false);
      } finally {
        noData.stop();
      }
    });
  });

  describe('when the tab mounts again after the cycles failed', () => {
    it('should show the error block at once, never a place', async () => {
      vi.mocked(api.getCycles).mockResolvedValue(fail(404));
      const { store } = renderTab();
      await screen.findByRole('alert');
      cleanup();
      const entries = watchFor(ENTRIES);

      try {
        mountTab(store);

        expect(screen.getByRole('alert').textContent).toBe(
          'Something went wrong while loading your places.',
        );
        expect(entries.seen()).toBe(false);
      } finally {
        entries.stop();
      }
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

  describe('when the user acts on My Places', () => {
    const tracked = (event: string) =>
      vi
        .mocked(analytics.track)
        .mock.calls.filter(([name]) => name === event)
        .map(([, properties]) => properties);

    it('should track choosing a closed cycle once', async () => {
      const { container } = renderTab();
      await within(container).findByRole('article', { name: 'Example Place a' });

      await chooseCycle('Oct 1 - Oct 15, 2026');

      expect(tracked('Creator Fund Cycle Changed')).toEqual([
        { tab: 'my_places', cycle_id: OLDEST_CLOSED.id },
      ]);
    });

    describe('and the current cycle has no places', () => {
      beforeEach(() => {
        vi.mocked(api.getPlaces).mockResolvedValue(ok(myPlaces([])));
      });

      it.each([
        ['Create a scene', 'create_scene'],
        ['Start from a template', 'start_from_template'],
      ] as const)('should track %s once', async (button, action) => {
        vi.mocked(workspace.createProject).mockResolvedValue({ path: '/scenes/New Scene' });
        const { container } = renderTab();

        fireEvent.click(await within(container).findByRole('button', { name: button }));

        expect(tracked('Creator Fund Empty State Action')).toEqual([{ action }]);
      });

      it('should track opening an unpublished scene once, without its name or path', async () => {
        vi.mocked(fs.exists).mockResolvedValue(true);
        vi.mocked(workspace.hasNodeModules).mockReturnValue(new Promise(() => {}));
        const { container } = renderTab({ projects: [localProject('Scene Private')] });

        fireEvent.click(await within(container).findByRole('button', { name: 'Scene Private' }));

        expect(tracked('Creator Fund Empty State Action')).toEqual([{ action: 'open_scene' }]);
        expect(JSON.stringify(vi.mocked(analytics.track).mock.calls)).not.toContain(
          'Scene Private',
        );
      });
    });
  });
});
