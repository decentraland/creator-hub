import { describe, it, expect } from 'vitest';

import { resolveOutdated } from '../../src/modules/outdated';

describe('resolveOutdated', () => {
  describe('when the installed version is a clean release behind latest', () => {
    it('should keep the update prompt', () => {
      const info = { current: '7.20.0', latest: '7.24.2' };
      expect(resolveOutdated(info)).toEqual(info);
    });

    it('should keep the prompt for a patch-level update', () => {
      const info = { current: '7.11.2', latest: '7.11.3' };
      expect(resolveOutdated(info)).toEqual(info);
    });
  });

  describe('when the installed version has a prerelease or build suffix', () => {
    it('should suppress an auth-server commit build behind latest', () => {
      expect(
        resolveOutdated({ current: '7.24.3-28199504206.commit-1a6c780', latest: '7.25.0' }),
      ).toBeNull();
    });

    it('should suppress a commit build of the same line as latest', () => {
      expect(resolveOutdated({ current: '7.25.0-1234.commit-abc', latest: '7.25.0' })).toBeNull();
    });

    it('should suppress a commit build ahead of latest (e.g. next/experimental)', () => {
      expect(resolveOutdated({ current: '7.26.0-x.commit-y', latest: '7.25.0' })).toBeNull();
    });

    it('should suppress a plain prerelease (e.g. rc)', () => {
      expect(resolveOutdated({ current: '7.24.3-rc.1', latest: '7.25.0' })).toBeNull();
    });

    it('should suppress a canary build', () => {
      expect(
        resolveOutdated({ current: '19.3.0-canary-d5736f09-20260507', latest: '19.2.7' }),
      ).toBeNull();
    });

    it('should suppress a version with build metadata', () => {
      expect(resolveOutdated({ current: '7.24.3+build.5', latest: '7.25.0' })).toBeNull();
    });
  });

  describe('when the installed version is a clean release not behind latest', () => {
    it('should suppress a version equal to latest', () => {
      expect(resolveOutdated({ current: '7.25.0', latest: '7.25.0' })).toBeNull();
    });

    it('should suppress a version ahead of latest', () => {
      expect(resolveOutdated({ current: '7.26.0', latest: '7.25.0' })).toBeNull();
    });
  });

  describe('when the installed version is not a valid semver', () => {
    it('should suppress git/file specifiers', () => {
      expect(
        resolveOutdated({ current: 'github:decentraland/js-sdk-toolchain', latest: '7.24.2' }),
      ).toBeNull();
    });
  });

  describe('when latest is not a valid semver', () => {
    it('should suppress the prompt', () => {
      expect(resolveOutdated({ current: '7.20.0', latest: 'unknown' })).toBeNull();
    });
  });
});
