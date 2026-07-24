import { Provider as StoreProvider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { getKeys } from '/@/modules/store/translation/utils';
import { actions as featureFlagsActions } from '/@/modules/store/featureFlags';
import { METRICS_FEATURE_FLAG } from '/@/lib/metrics';
import { createTestStore, type TestStore } from '../../../tests/utils/testStore';
import { Navbar, NavbarItem } from './component';

vi.mock('../Header', () => ({
  Header: ({ children }: { children: React.ReactNode }) => <nav>{children}</nav>,
}));
vi.mock('../ConnectionStatusIndicator', () => ({ ConnectionStatusIndicator: () => null }));
vi.mock('../Modals/AppSettings', () => ({ AppSettings: () => null }));

function enableMetrics(store: TestStore) {
  store.dispatch(
    featureFlagsActions.fetchFeatureFlags.fulfilled(
      { flags: { [METRICS_FEATURE_FLAG]: true }, variants: {} },
      'req',
      undefined,
    ),
  );
}

function renderNavbar(store: TestStore) {
  return render(
    <StoreProvider store={store}>
      <MemoryRouter>
        <Navbar active={NavbarItem.METRICS} />
      </MemoryRouter>
    </StoreProvider>,
  );
}

describe('Navbar', () => {
  beforeAll(() => {
    getKeys('en');
  });

  afterEach(() => {
    cleanup();
  });

  it('hides the Analytics item when the metrics flag is off', () => {
    renderNavbar(createTestStore());
    expect(screen.queryByText('Analytics')).toBeNull();
    expect(screen.getByText('Manage')).toBeDefined();
  });

  it('shows an Analytics item linking to /metrics when the flag is on', () => {
    const store = createTestStore();
    enableMetrics(store);
    renderNavbar(store);
    const link = screen.getByText('Analytics').closest('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/metrics');
  });
});
