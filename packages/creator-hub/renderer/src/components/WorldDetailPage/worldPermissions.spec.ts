import { describe, expect, it } from 'vitest';

import { WorldRoleType } from '/@/lib/worlds';
import { ManagedProjectType, type ManagedProject } from '/shared/types/manage';

import { getWorldPermissions } from './worldPermissions';

const world = (overrides: Partial<ManagedProject>): ManagedProject => ({
  id: 'plaza.dcl.eth',
  displayName: 'plaza.dcl.eth',
  type: ManagedProjectType.WORLD,
  role: WorldRoleType.OWNER,
  ...overrides,
});

describe('getWorldPermissions', () => {
  describe('when the account owns the World', () => {
    it('should show every tab, Details first, and let it manage the scenes', () => {
      expect(getWorldPermissions(world({}))).toEqual({
        tabs: ['details', 'scenes', 'settings', 'collaborators'],
        scenes: 'manage',
        header: 'owner',
        access: 'manage',
      });
    });
  });

  describe('when the account can deploy to some parcels of the World', () => {
    it('should show only the Scenes tab, for viewing', () => {
      expect(getWorldPermissions(world({ role: WorldRoleType.COLLABORATOR }), 'parcels')).toEqual({
        tabs: ['scenes'],
        scenes: 'view',
        header: 'collaborator',
        access: 'hidden',
      });
    });
  });

  describe('when the account can deploy anywhere in the World', () => {
    it('should add Details and Settings, but keep Access and Collaborators for the owner', () => {
      expect(getWorldPermissions(world({ role: WorldRoleType.COLLABORATOR }), 'world')).toEqual({
        tabs: ['details', 'scenes', 'settings'],
        scenes: 'view',
        header: 'collaborator',
        access: 'hidden',
      });
    });
  });

  describe('when the account can only stream to the World', () => {
    it('should give it no detail page', () => {
      expect(
        getWorldPermissions(world({ role: WorldRoleType.COLLABORATOR, access: 'stream' })),
      ).toBeNull();
    });
  });
});
