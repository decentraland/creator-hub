import { describe, it, expect } from 'vitest';

import { resolveOutdated } from '../../src/modules/outdated';

describe('resolveOutdated', () => {
  const AUTH_SERVER = '7.24.3-28199504206.commit-1a6c780';
  const distTags = {
    latest: '7.24.2',
    next: '7.24.3-28263300619.commit-182d37c',
    'auth-server': AUTH_SERVER,
  };

  describe('when the installed version is a prerelease build of the official latest', () => {
    it('should suppress it (same major.minor.patch as latest)', () => {
      expect(
        resolveOutdated(
          { current: '7.24.3-28199504206.commit-1a6c780', latest: '7.24.3' },
          { latest: '7.24.3' },
        ),
      ).toBeNull();
    });

    it('should suppress a plain prerelease of latest (e.g. rc)', () => {
      expect(resolveOutdated({ current: '7.24.3-rc.1', latest: '7.24.3' }, {})).toBeNull();
    });
  });

  describe('when the installed version is on the auth-server line', () => {
    it('should suppress when it is exactly the current auth-server build', () => {
      expect(resolveOutdated({ current: AUTH_SERVER, latest: '7.24.2' }, distTags)).toBeNull();
    });

    it('should offer the auth-server build when on an older build of that line', () => {
      const current = '7.24.3-28000000000.commit-aaaaaaa';
      expect(resolveOutdated({ current, latest: '7.24.2' }, distTags)).toEqual({
        current,
        latest: AUTH_SERVER,
      });
    });

    it('should suppress when on the same line but ahead of the auth-server build', () => {
      // e.g. a `next` build with a higher run id than the auth-server tag
      expect(resolveOutdated({ current: distTags.next, latest: '7.24.2' }, distTags)).toBeNull();
    });
  });

  describe('when the installed version is genuinely behind the official latest', () => {
    it('should keep a normal release that is behind latest', () => {
      const info = { current: '7.20.0', latest: '7.24.2' };
      expect(resolveOutdated(info, distTags)).toEqual(info);
    });

    it('should keep an unrelated old prerelease (different base, not auth-server)', () => {
      const info = { current: '7.20.0-21000000000.commit-bbbbbbb', latest: '7.24.2' };
      expect(resolveOutdated(info, distTags)).toEqual(info);
    });
  });

  describe('when the installed version is not a valid semver', () => {
    it('should leave it untouched (e.g. git/file specifiers)', () => {
      const info = { current: 'github:decentraland/js-sdk-toolchain', latest: '7.24.2' };
      expect(resolveOutdated(info, distTags)).toEqual(info);
    });
  });

  describe('when there is no auth-server dist-tag', () => {
    it('should keep a version that is genuinely behind latest', () => {
      const info = { current: '7.20.0', latest: '7.24.2' };
      expect(resolveOutdated(info, { latest: '7.24.2' })).toEqual(info);
    });
  });
});
