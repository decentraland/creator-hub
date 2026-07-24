import React from 'react';
import { Provider as StoreProvider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { analytics, misc } from '#preload';
import { AuthContext } from '/@/contexts/AuthContext';
import { getKeys } from '/@/modules/store/translation/utils';
import { createTestStore } from '../../../tests/utils/testStore';
import {
  FIXTURE_ADDRESS,
  FIXTURE_AS_OF,
  creatorScenesStatsFixture,
  honestEmptyScene,
} from '../../../tests/fixtures/metrics';
import { MetricsPage } from './component';

const createMockMetricsAPI = () => ({
  fetchCreatorScenesStats: vi.fn(),
});

let mockMetricsAPI: ReturnType<typeof createMockMetricsAPI>;

vi.mock('/@/lib/metrics', () => ({
  METRICS_FEATURE_FLAG: 'creatorhub-creator-hub-metrics',
  RANKING_FEATURE_FLAG: 'creatorhub-creator-hub-metrics-ranking',
  isMetricsEnabled: (flags: Record<string, boolean>) => !!flags['creatorhub-creator-hub-metrics'],
  isRankingEnabled: (flags: Record<string, boolean>) =>
    !!(flags && flags['creatorhub-creator-hub-metrics-ranking']),
  Metrics: class {
    constructor() {
      return mockMetricsAPI;
    }
  },
}));

const mockRunProject = vi.fn();
let mockLocalProjects: Array<Record<string, unknown>> = [];

vi.mock('/@/hooks/useWorkspace', () => ({
  useWorkspace: () => ({ projects: mockLocalProjects, runProject: mockRunProject }),
}));

vi.mock('/@/components/Navbar', () => ({
  Navbar: () => <div data-testid="navbar" />,
  NavbarItem: {
    HOME: 'home',
    SCENES: 'scenes',
    COLLECTIONS: 'collections',
    METRICS: 'metrics',
    LEARN: 'learn',
    MANAGE: 'manage',
    MORE: 'more',
  },
}));

const createAuthValue = (overrides: Partial<React.ContextType<typeof AuthContext>> = {}) =>
  ({
    wallet: FIXTURE_ADDRESS,
    chainId: 1,
    avatar: undefined,
    isSignedIn: true,
    isSigningIn: false,
    signIn: vi.fn(),
    cancelSignIn: vi.fn(),
    reopenSignInDapp: vi.fn(),
    copySignInUrl: vi.fn(),
    signOut: vi.fn(),
    changeNetwork: vi.fn(),
    ...overrides,
  }) as NonNullable<React.ContextType<typeof AuthContext>>;

type RenderOptions = {
  authValue?: ReturnType<typeof createAuthValue>;
  initialEntries?: React.ComponentProps<typeof MemoryRouter>['initialEntries'];
};

function renderPage({ authValue = createAuthValue(), initialEntries }: RenderOptions = {}) {
  const store = createTestStore();
  return render(
    <StoreProvider store={store}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={initialEntries ?? ['/metrics']}>
          <MetricsPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </StoreProvider>,
  );
}

function renderDrilldown(
  state: { sceneType: string; sceneId: string; source?: string },
  opts: RenderOptions = {},
) {
  return renderPage({ ...opts, initialEntries: [{ pathname: '/metrics', state }] });
}

describe('MetricsPage', () => {
  beforeAll(() => {
    getKeys('en');
  });

  beforeEach(() => {
    mockMetricsAPI = createMockMetricsAPI();
    mockMetricsAPI.fetchCreatorScenesStats.mockResolvedValue(creatorScenesStatsFixture);
    mockLocalProjects = [];
  });

  afterEach(() => {
    cleanup();
  });

  describe('when the user is signed out', () => {
    it('should show the sign in card and not fetch', () => {
      renderPage({
        authValue: createAuthValue({ wallet: undefined, isSignedIn: false }),
      });
      expect(screen.getByText('Sign in to view your scene metrics')).toBeDefined();
      expect(mockMetricsAPI.fetchCreatorScenesStats).not.toHaveBeenCalled();
    });
  });

  describe('when the stats are loading', () => {
    it('should show the loader', () => {
      mockMetricsAPI.fetchCreatorScenesStats.mockReturnValue(new Promise(() => {}));
      renderPage();
      expect(screen.getByRole('progressbar')).toBeDefined();
    });
  });

  describe('when the creator has no scenes', () => {
    it('should show the empty state', async () => {
      mockMetricsAPI.fetchCreatorScenesStats.mockResolvedValue({
        address: FIXTURE_ADDRESS,
        asOf: '2026-07-21',
        scenes: [],
      });
      renderPage();
      expect(await screen.findByText('No published scenes yet')).toBeDefined();
    });
  });

  describe('when the fetch fails', () => {
    it('should show the error state with a retry action', async () => {
      mockMetricsAPI.fetchCreatorScenesStats.mockRejectedValue(new Error('boom'));
      renderPage();
      expect(await screen.findByText('Could not load metrics')).toBeDefined();
      expect(screen.getByText('Retry')).toBeDefined();
    });
  });

  describe('the portfolio landing (default view)', () => {
    it('lists the creator worlds and genesis scenes as rows', async () => {
      renderPage();
      expect(await screen.findByText('kickoff.dcl.eth')).toBeDefined();
      expect(screen.getByText('hidden-gem.dcl.eth')).toBeDefined();
      expect(screen.getByText('Plaza Corner')).toBeDefined();
      expect(screen.getByText('Quiet Parcel')).toBeDefined();
      expect(screen.getAllByText('World').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('Genesis').length).toBeGreaterThanOrEqual(2);
      expect(screen.queryByText(/^Analytics - /)).toBeNull();
    });

    it('tracks the metrics viewed event with a direct source', async () => {
      renderPage();
      await screen.findByText('Plaza Corner');
      expect(analytics.track).toHaveBeenCalledWith('Metrics Viewed', {
        source: 'direct',
        scene_type: undefined,
        scene_id: undefined,
      });
    });

    it('drills into a genesis scene on row click', async () => {
      renderPage();
      fireEvent.click(await screen.findByText('Plaza Corner'));
      expect(await screen.findByText('Analytics - Plaza Corner')).toBeDefined();
    });

    it('drills into a world scene on row click', async () => {
      renderPage();
      fireEvent.click(await screen.findByText('kickoff.dcl.eth'));
      expect(await screen.findByText('Analytics - kickoff.dcl.eth')).toBeDefined();
    });

    it('returns to the list from the drill-down back chevron', async () => {
      renderPage();
      fireEvent.click(await screen.findByText('Plaza Corner'));
      await screen.findByText('Analytics - Plaza Corner');

      fireEvent.click(screen.getByLabelText('All scenes'));
      expect(await screen.findByText('kickoff.dcl.eth')).toBeDefined();
      expect(screen.queryByText('Analytics - Plaza Corner')).toBeNull();
    });

    it('shows a single scene as one list row (no auto drill-down)', async () => {
      mockMetricsAPI.fetchCreatorScenesStats.mockResolvedValue({
        address: FIXTURE_ADDRESS,
        asOf: FIXTURE_AS_OF,
        scenes: [honestEmptyScene],
      });
      renderPage();
      expect(await screen.findByText('sparse.dcl.eth')).toBeDefined();
      expect(screen.queryByText('Analytics - sparse.dcl.eth')).toBeNull();
    });
  });

  describe('the scene drill-down (reached by deep link)', () => {
    it('should render the scene analytics header', async () => {
      renderDrilldown({ sceneType: 'genesis', sceneId: '-3|-2' });
      expect(await screen.findByText('Analytics - Plaza Corner')).toBeDefined();
    });

    it('should render the overview tiles with the 30-day window totals', async () => {
      renderDrilldown({ sceneType: 'genesis', sceneId: '-3|-2' });
      await screen.findByText('Analytics - Plaza Corner');
      expect(screen.getByText('Total Visits')).toBeDefined();
      expect(screen.getByText('1,500')).toBeDefined();
      expect(screen.getByText('Daily Active Users')).toBeDefined();
    });

    it('should show D7 retention as a green percentage', async () => {
      renderDrilldown({ sceneType: 'genesis', sceneId: '-3|-2' });
      await screen.findByText('Analytics - Plaza Corner');
      expect(screen.getByText('36%')).toBeDefined();
      expect(screen.getByLabelText(/came back at least once within 7 days/)).toBeDefined();
    });

    it('should render revenue as honest-empty, never a number', async () => {
      renderDrilldown({ sceneType: 'genesis', sceneId: '-3|-2' });
      await screen.findByText('Analytics - Plaza Corner');
      expect(screen.getByText('Revenue')).toBeDefined();
      expect(screen.getByLabelText(/monetization isn't available yet/)).toBeDefined();
    });

    it('should keep the deferred places ranking hidden by default', async () => {
      renderDrilldown({ sceneType: 'genesis', sceneId: '-3|-2' });
      await screen.findByText('Analytics - Plaza Corner');
      expect(screen.queryByText('Places Ranking')).toBeNull();
    });

    it('should render the three retention charts', async () => {
      const { container } = renderDrilldown({ sceneType: 'genesis', sceneId: '-3|-2' });
      await screen.findByText('Analytics - Plaza Corner');
      expect(screen.getByText('Day 1 Retention')).toBeDefined();
      expect(screen.getByText('Day 7 Retention')).toBeDefined();
      expect(screen.getByText('Day 30 Retention')).toBeDefined();
      expect(container.querySelector('.series-line')).not.toBeNull();
    });

    it('should render the social interactions multi-line chart with a legend', async () => {
      renderDrilldown({ sceneType: 'genesis', sceneId: '-3|-2' });
      await screen.findByText('Analytics - Plaza Corner');
      expect(screen.getByText('Social Interactions')).toBeDefined();
      expect(screen.getByText('Messages Sent')).toBeDefined();
      expect(screen.getByText('Emotes Played')).toBeDefined();
    });

    it('shows a world drill-down by its world name', async () => {
      renderDrilldown({ sceneType: 'world', sceneId: 'hidden-gem.dcl.eth' });
      await screen.findByText('Analytics - hidden-gem.dcl.eth');
      expect(screen.getAllByText('Not enough data').length).toBeGreaterThanOrEqual(3);
    });

    it('renders honest zeros for a zero-traffic scene', async () => {
      renderDrilldown({ sceneType: 'genesis', sceneId: '10|20' });
      await screen.findByText('Analytics - Quiet Parcel');
      expect(screen.getByText('Total Visits')).toBeDefined();
      expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    });

    it('renders an em dash for a fully honest-empty scene without crashing', async () => {
      mockMetricsAPI.fetchCreatorScenesStats.mockResolvedValue({
        address: FIXTURE_ADDRESS,
        asOf: FIXTURE_AS_OF,
        scenes: [honestEmptyScene],
      });
      renderDrilldown({ sceneType: 'world', sceneId: 'sparse.dcl.eth' });
      await screen.findByText('Analytics - sparse.dcl.eth');
      expect(screen.getByText('Total Visits')).toBeDefined();
      expect(screen.getAllByText('—').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Not enough data').length).toBeGreaterThanOrEqual(3);
    });

    it('disables Edit Scene when the scene has no project on this machine', async () => {
      renderDrilldown({ sceneType: 'world', sceneId: 'hidden-gem.dcl.eth' });
      await screen.findByText('Analytics - hidden-gem.dcl.eth');
      const button = screen.getByText('Edit Scene').closest('button');
      expect(button?.disabled).toBe(true);
      fireEvent.click(button!);
      expect(mockRunProject).not.toHaveBeenCalled();
    });

    it('opens the events submit page from Create Event', async () => {
      renderDrilldown({ sceneType: 'world', sceneId: 'hidden-gem.dcl.eth' });
      await screen.findByText('Analytics - hidden-gem.dcl.eth');
      fireEvent.click(screen.getByText('Create Event'));
      expect(misc.openExternal).toHaveBeenCalledWith('https://decentraland.org/events/submit');
    });

    it('copies the jump-in url from Copy URL', async () => {
      renderDrilldown({ sceneType: 'world', sceneId: 'hidden-gem.dcl.eth' });
      await screen.findByText('Analytics - hidden-gem.dcl.eth');
      fireEvent.click(screen.getByText('Copy URL'));
      expect(misc.copyToClipboard).toHaveBeenCalledWith(
        'https://decentraland.org/play/?realm=hidden-gem.dcl.eth',
      );
    });

    it('opens the play client from Jump In', async () => {
      renderDrilldown({ sceneType: 'world', sceneId: 'hidden-gem.dcl.eth' });
      await screen.findByText('Analytics - hidden-gem.dcl.eth');
      fireEvent.click(screen.getByText('Jump In'));
      expect(misc.openExternal).toHaveBeenCalledWith(
        'https://decentraland.org/play/?realm=hidden-gem.dcl.eth',
      );
    });

    it('opens the matching local project in the editor from Edit Scene', async () => {
      mockLocalProjects = [
        { path: '/tmp/other', worldConfiguration: { name: 'another.dcl.eth' } },
        { path: '/tmp/hidden-gem', worldConfiguration: { name: 'Hidden-Gem.dcl.eth' } },
      ];
      renderDrilldown({ sceneType: 'world', sceneId: 'hidden-gem.dcl.eth' });
      await screen.findByText('Analytics - hidden-gem.dcl.eth');
      fireEvent.click(screen.getByText('Edit Scene'));
      expect(mockRunProject).toHaveBeenCalledWith(mockLocalProjects[1]);
    });

    it('tracks the entry source for a preselected scene', async () => {
      renderDrilldown({
        sceneType: 'world',
        sceneId: 'kickoff.dcl.eth',
        source: 'publish-success',
      });
      expect(await screen.findByText('Analytics - kickoff.dcl.eth')).toBeDefined();
      expect(analytics.track).toHaveBeenCalledWith('Metrics Viewed', {
        source: 'publish-success',
        scene_type: 'world',
        scene_id: 'kickoff.dcl.eth',
      });
    });
  });

  describe('when a deep link points at a scene with no analytics row', () => {
    it('shows the honest no-data state, not a wrong scene', async () => {
      renderDrilldown({ sceneType: 'world', sceneId: 'never-published.dcl.eth', source: 'editor' });
      expect(await screen.findByText('No analytics for this scene yet')).toBeDefined();
      expect(screen.queryByText(/^Analytics - /)).toBeNull();
    });

    it('returns to the list from the no-data back chevron', async () => {
      renderDrilldown({ sceneType: 'world', sceneId: 'never-published.dcl.eth', source: 'editor' });
      await screen.findByText('No analytics for this scene yet');
      fireEvent.click(screen.getByLabelText('All scenes'));
      expect(await screen.findByText('kickoff.dcl.eth')).toBeDefined();
    });
  });

  describe('when exporting the analytics csv', () => {
    it('should build a blob with the extended daily rows', async () => {
      const blobs: Blob[] = [];
      URL.createObjectURL = vi.fn((blob: Blob) => {
        blobs.push(blob);
        return 'blob:mock';
      });
      URL.revokeObjectURL = vi.fn();

      renderDrilldown({ sceneType: 'genesis', sceneId: '-3|-2' });
      await screen.findByText('Analytics - Plaza Corner');
      fireEvent.click(screen.getByText('Export Analytics'));

      await waitFor(() => expect(blobs).toHaveLength(1));
      const csv = await blobs[0].text();
      const lines = csv.split('\n');
      expect(lines[0]).toBe(
        'date,visits,unique_users,new_users,median_active_time_s,peak_concurrent_users,messages_sent,emotes_played',
      );
      expect(lines).toHaveLength(91);
      expect(lines[90]).toBe('2026-07-21,50,30,5,150,27,110,55');
    });
  });
});
