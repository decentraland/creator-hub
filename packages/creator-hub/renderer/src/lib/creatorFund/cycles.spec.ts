import { describe, expect, it } from 'vitest';

import { closedCycles, currentCycle } from './cycles';

const at = (iso: string) => new Date(iso).getTime();

describe('currentCycle', () => {
  describe('when the date is in the second half of a month', () => {
    it('should run from the 16th to the last day of that month', () => {
      expect(currentCycle(at('2026-10-22T12:00:00Z')).id).toBe('2026-10-16_2026-10-31');
    });
  });

  describe('when the date is the 15th', () => {
    it('should still be the first half', () => {
      expect(currentCycle(at('2026-10-15T23:59:59Z')).id).toBe('2026-10-01_2026-10-15');
    });
  });

  describe('when February has 28 days', () => {
    it('should end the second half on the 28th', () => {
      expect(currentCycle(at('2027-02-20T00:00:00Z')).end_date).toBe('2027-02-28');
    });
  });
});

describe('closedCycles', () => {
  describe('when five cycles have closed since the beta started', () => {
    it('should list them newest first', () => {
      expect(closedCycles(at('2026-10-22T00:00:00Z')).map(cycle => cycle.id)).toEqual([
        '2026-10-01_2026-10-15',
        '2026-09-16_2026-09-30',
        '2026-09-01_2026-09-15',
        '2026-08-16_2026-08-31',
        '2026-08-01_2026-08-15',
      ]);
    });
  });

  describe('when fewer cycles than requested exist', () => {
    it('should stop at the first beta cycle', () => {
      expect(closedCycles(at('2026-08-20T00:00:00Z')).map(cycle => cycle.id)).toEqual([
        '2026-08-01_2026-08-15',
      ]);
    });
  });
});
