import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { isOwnWrite, markOwnWrite } from './own-writes';

describe('own-writes', () => {
  beforeEach(() => {
    // `performance` is not in vitest's default toFake set, and it is the clock
    // this module reads — without it advanceTimersByTime moves nothing here.
    vi.useFakeTimers({ toFake: ['performance'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('when nothing has been written', () => {
    it('should not claim any file', () => {
      expect(isOwnWrite('src/index.ts')).toBe(false);
    });
  });

  describe('when the inspector has just written a file', () => {
    beforeEach(() => {
      markOwnWrite('src/ui/root.tsx');
    });

    it('should recognise the scene-relative path the bundler trigger arrives as', () => {
      expect(isOwnWrite('src/ui/root.tsx')).toBe(true);
    });

    it('should recognise Windows separators and a leading ./', () => {
      markOwnWrite('src/ui/other.tsx');
      expect(isOwnWrite('src\\ui\\other.tsx')).toBe(true);
      markOwnWrite('src/ui/third.tsx');
      expect(isOwnWrite('./src/ui/third.tsx')).toBe(true);
    });

    it('should not match a different file, even one that merely ends with the same path', () => {
      expect(isOwnWrite('src/ui/other-root.tsx')).toBe(false);
      expect(isOwnWrite('vendor/src/ui/root.tsx')).toBe(false);
    });

    it('should keep matching while the bundler may still name it', () => {
      vi.advanceTimersByTime(9_999);

      expect(isOwnWrite('src/ui/root.tsx')).toBe(true);
    });

    it('should forget a write the bundler never named once the window has passed', () => {
      vi.advanceTimersByTime(10_000);

      expect(isOwnWrite('src/ui/root.tsx')).toBe(false);
    });
  });

  describe('when the bundler has named the written file', () => {
    beforeEach(() => {
      markOwnWrite('src/ui/root.tsx');
      expect(isOwnWrite('src/ui/root.tsx')).toBe(true);
    });

    it('should still claim an immediate second naming of the same write', () => {
      vi.advanceTimersByTime(999);

      expect(isOwnWrite('src/ui/root.tsx')).toBe(true);
    });

    it('should treat the file named again later as a real edit', () => {
      vi.advanceTimersByTime(1_000);

      expect(isOwnWrite('src/ui/root.tsx')).toBe(false);
    });
  });
});
