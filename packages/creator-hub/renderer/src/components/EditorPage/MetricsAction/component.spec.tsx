import { Provider as StoreProvider } from 'react-redux';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { getKeys } from '/@/modules/store/translation/utils';
import { actions as featureFlagsActions } from '/@/modules/store/featureFlags';
import type { Project } from '/shared/types/projects';
import { createTestStore, type TestStore } from '../../../../tests/utils/testStore';
import { MetricsAction } from './component';

const METRICS_FLAG = 'creatorhub-creator-hub-metrics';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = (await vi.importActual('react-router-dom')) as Record<string, unknown>;
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('/@/lib/metrics', () => ({
  isMetricsEnabled: (flags: Record<string, boolean>) => !!flags[METRICS_FLAG],
}));

const project = (overrides: Partial<Project> = {}): Project =>
  ({
    id: 'p',
    path: '/tmp/p',
    title: 'My Scene',
    scene: { base: '0,0', parcels: ['0,0'] },
    ...overrides,
  }) as unknown as Project;

function enableMetrics(store: TestStore) {
  store.dispatch(
    featureFlagsActions.fetchFeatureFlags.fulfilled(
      { flags: { [METRICS_FLAG]: true }, variants: {} },
      'req',
      undefined,
    ),
  );
}

function renderAction(proj: Project | undefined, { enabled = true } = {}) {
  const store = createTestStore();
  if (enabled) enableMetrics(store);
  return render(
    <StoreProvider store={store}>
      <MetricsAction project={proj} />
    </StoreProvider>,
  );
}

describe('MetricsAction (editor entry)', () => {
  beforeAll(() => {
    getKeys('en');
  });

  afterEach(() => {
    navigateMock.mockReset();
    cleanup();
  });

  it('renders nothing when the metrics flag is off', () => {
    renderAction(project({ worldConfiguration: { name: 'w.dcl.eth' } }), { enabled: false });
    expect(screen.queryByText('Analytics')).toBeNull();
  });

  it('navigates to the world drill-down when the scene is deployed to a World', () => {
    renderAction(project({ worldConfiguration: { name: 'Kick-Off.dcl.eth' } }));
    fireEvent.click(screen.getByText('Analytics'));
    expect(navigateMock).toHaveBeenCalledWith('/metrics', {
      state: { sceneType: 'world', sceneId: 'kick-off.dcl.eth', source: 'editor' },
    });
  });

  it('navigates to the genesis drill-down when the scene is deployed to LAND', () => {
    renderAction(project({ scene: { base: '10,20', parcels: ['10,20'] } }));
    fireEvent.click(screen.getByText('Analytics'));
    expect(navigateMock).toHaveBeenCalledWith('/metrics', {
      state: { sceneType: 'genesis', sceneId: '10|20', source: 'editor' },
    });
  });

  it('disables the entry and does not navigate for an undeployed scene', () => {
    renderAction(project());
    const button = screen.getByRole('button', { name: /Analytics/ });
    expect(button).toHaveProperty('disabled', true);
    fireEvent.click(button);
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
