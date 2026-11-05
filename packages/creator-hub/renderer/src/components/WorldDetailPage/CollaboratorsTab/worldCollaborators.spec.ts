import { describe, expect, it } from 'vitest';

import { WorldPermissionType, type WorldPermissions } from '/@/lib/worlds';

import { getWorldCollaborators, isStreamOpen, removalKind } from './worldCollaborators';

const OWNER = '0x00000000000000000000000000000000000000a1';
const ANA = '0x00000000000000000000000000000000000000b2';
const BEN = '0x00000000000000000000000000000000000000c3';
const CAL = '0x00000000000000000000000000000000000000d4';

const permissions = (streaming: WorldPermissions['streaming']): WorldPermissions => ({
  deployment: { type: WorldPermissionType.AllowList, wallets: [OWNER, ANA] },
  access: { type: WorldPermissionType.Unrestricted },
  streaming,
});

describe('getWorldCollaborators', () => {
  describe('when the World has deploy and stream collaborators', () => {
    const rows = getWorldCollaborators({
      owner: OWNER,
      permissions: permissions({ type: WorldPermissionType.AllowList, wallets: [ANA, CAL] }),
      summary: {
        [OWNER]: [{ permission: 'deployment', worldWide: true }],
        [ANA]: [
          { permission: 'deployment', worldWide: true },
          { permission: 'streaming', worldWide: true },
        ],
        [BEN.toUpperCase()]: [{ permission: 'deployment', worldWide: false, parcelCount: 3 }],
        [CAL]: [{ permission: 'streaming', worldWide: true }],
      },
    });

    it('should list each wallet once, leaving out the owner', () => {
      expect(rows.map(row => row.address)).toEqual([ANA, BEN, CAL]);
    });

    it('should read the deploy scope as all, some parcels or none', () => {
      expect(rows.map(row => row.deploy)).toEqual([
        { kind: 'all' },
        { kind: 'parcels', count: 3 },
        { kind: 'none' },
      ]);
    });

    it('should read the stream permission from the streaming allow-list', () => {
      expect(rows.map(row => row.stream)).toEqual([true, false, true]);
    });
  });

  describe('when streaming is open to everyone', () => {
    it('should not list anyone for streaming alone', () => {
      const rows = getWorldCollaborators({
        owner: OWNER,
        permissions: permissions({ type: WorldPermissionType.Unrestricted }),
        summary: {},
      });

      expect(rows).toEqual([{ address: ANA, deploy: { kind: 'all' }, stream: false }]);
    });
  });

  describe('when the permissions have not loaded', () => {
    it('should list no one', () => {
      expect(getWorldCollaborators({ owner: OWNER, permissions: null, summary: {} })).toEqual([]);
    });
  });
});

describe('removalKind', () => {
  it('should be one for a single row, all for every row, several otherwise', () => {
    expect(removalKind(1, 3)).toBe('one');
    expect(removalKind(3, 3)).toBe('all');
    expect(removalKind(2, 3)).toBe('several');
  });
});

describe('isStreamOpen', () => {
  it('should be open when streaming is unrestricted, and not for an allow-list', () => {
    expect(isStreamOpen(permissions({ type: WorldPermissionType.Unrestricted }))).toBe(true);
    expect(isStreamOpen(permissions({ type: WorldPermissionType.AllowList, wallets: [] }))).toBe(
      false,
    );
    expect(isStreamOpen(null)).toBe(false);
  });
});
