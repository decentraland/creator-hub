import { describe, expect, it } from 'vitest';

import { RoleType } from '/@/lib/land';

import { getLandPermissions } from './landPermissions';

describe('getLandPermissions', () => {
  it('should give the owner every tab and Transfer, with no role row', () => {
    expect(getLandPermissions(RoleType.OWNER)).toEqual({
      tabs: ['details', 'scenes', 'collaborators', 'managers'],
      transfer: true,
      editDetails: true,
      unpublish: true,
      roleRow: false,
    });
  });

  it('should treat a lessor as an owner header with actions disabled while rented', () => {
    expect(getLandPermissions(RoleType.LESSOR)).toEqual({
      tabs: ['details', 'scenes'],
      transfer: false,
      editDetails: false,
      unpublish: false,
      roleRow: false,
    });
  });

  it('should let a manager edit and manage collaborators, but not managers or Transfer', () => {
    expect(getLandPermissions(RoleType.MANAGER)).toEqual({
      tabs: ['details', 'scenes', 'collaborators'],
      transfer: false,
      editDetails: true,
      unpublish: true,
      roleRow: true,
    });
  });

  it('should let a collaborator edit the details and unpublish', () => {
    expect(getLandPermissions(RoleType.OPERATOR)).toEqual({
      tabs: ['details', 'scenes'],
      transfer: false,
      editDetails: true,
      unpublish: true,
      roleRow: true,
    });
  });

  it('should keep the details read-only for a tenant', () => {
    expect(getLandPermissions(RoleType.TENANT)).toEqual({
      tabs: ['details', 'scenes'],
      transfer: false,
      editDetails: false,
      unpublish: true,
      roleRow: true,
    });
  });
});
