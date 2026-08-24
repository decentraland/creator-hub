import { describe, expect, it } from 'vitest';
import type { ParcelsPermission } from './slice';
import { hasWorldWidePermission } from './utils';

describe('hasWorldWidePermission', () => {
  describe('when the parcels fetch succeeded with an empty parcels array', () => {
    it('should return true', () => {
      const permission: ParcelsPermission = { parcels: [], status: 'succeeded' };
      expect(hasWorldWidePermission(permission)).toBe(true);
    });
  });

  describe('when the parcels fetch succeeded with specific parcels', () => {
    it('should return false', () => {
      const permission: ParcelsPermission = { parcels: ['0,0', '1,1'], status: 'succeeded' };
      expect(hasWorldWidePermission(permission)).toBe(false);
    });
  });

  describe('when the parcels fetch is still loading', () => {
    it('should return false even if parcels is empty', () => {
      const permission: ParcelsPermission = { parcels: [], status: 'loading' };
      expect(hasWorldWidePermission(permission)).toBe(false);
    });
  });

  describe('when the parcels fetch failed', () => {
    it('should return false even if parcels is empty', () => {
      const permission: ParcelsPermission = { parcels: [], status: 'failed' };
      expect(hasWorldWidePermission(permission)).toBe(false);
    });
  });

  describe('when no parcels permission state exists', () => {
    it('should return false', () => {
      expect(hasWorldWidePermission(undefined)).toBe(false);
    });
  });
});
