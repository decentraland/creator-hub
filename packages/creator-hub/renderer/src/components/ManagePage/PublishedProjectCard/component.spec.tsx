import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { type ManagedProject, ManagedProjectType, WorldSettingsTab } from '/shared/types/manage';
import { WorldRoleType } from '/@/lib/worlds';

import { PublishedProjectCard } from './component';

vi.mock('/@/hooks/useSnackbar', () => ({ useSnackbar: () => ({ pushGeneric: vi.fn() }) }));
vi.mock('/@/modules/store/translation/utils', async importOriginal => ({
  ...(await importOriginal<object>()),
  t: (id: string) => id,
}));

const SETTINGS = 'manage.cards.worlds.world_settings';
const LAYOUT = 'manage.cards.worlds.layout';

const createProject = (overrides: Partial<ManagedProject>): ManagedProject => ({
  id: 'shared-world.dcl.eth',
  displayName: 'shared-world.dcl.eth',
  type: ManagedProjectType.WORLD,
  role: WorldRoleType.COLLABORATOR,
  deployment: {
    title: 'Shared world',
    description: '',
    thumbnail: '',
    lastPublishedAt: 0,
    scenesCount: 1,
  },
  ...overrides,
});

describe('PublishedProjectCard', () => {
  afterEach(() => {
    cleanup();
  });

  const mount = (project: ManagedProject) => {
    const onOpenSettings = vi.fn();
    render(
      <ThemeProvider theme={dark}>
        <PublishedProjectCard
          project={project}
          onOpenSettings={onOpenSettings}
          onOpenPermissions={vi.fn()}
          onViewScenes={vi.fn()}
          onUnpublishWorld={vi.fn()}
        />
      </ThemeProvider>,
    );
    return onOpenSettings;
  };

  describe.each([
    ['the world owner', { role: WorldRoleType.OWNER }],
    ['a world-wide collaborator', { worldWideDeployment: true }],
  ])('when the wallet is %s', (_, overrides) => {
    it('should offer the full settings, opening on Details', () => {
      const onOpenSettings = mount(createProject(overrides));

      fireEvent.click(screen.getByText(SETTINGS));

      expect(screen.queryByText(LAYOUT)).toBeNull();
      expect(onOpenSettings).toHaveBeenCalledWith(WorldSettingsTab.DETAILS);
    });
  });

  describe.each([
    ['a parcel-only collaborator', { worldWideDeployment: false }],
    ['a collaborator whose access could not be read', {}],
  ])('when the wallet is %s', (_, overrides) => {
    it('should offer only the layout', () => {
      const onOpenSettings = mount(createProject(overrides));

      fireEvent.click(screen.getByText(LAYOUT));

      expect(screen.queryByText(SETTINGS)).toBeNull();
      expect(onOpenSettings).toHaveBeenCalledWith(WorldSettingsTab.LAYOUT);
    });
  });
});
