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
      expect(isOwnWrite('/scene/src/index.ts')).toBe(false);
    });
  });

  describe('when the inspector has just written a file', () => {
    beforeEach(() => {
      markOwnWrite('src/ui/root.tsx');
    });

    it('should recognise the absolute path the bundler prints', () => {
      expect(isOwnWrite('/Users/jane/scenes/demo/src/ui/root.tsx')).toBe(true);
    });

    it('should recognise a Windows path', () => {
      expect(isOwnWrite('C:\\scenes\\demo\\src\\ui\\root.tsx')).toBe(true);
    });

    it('should recognise the scene-relative form', () => {
      expect(isOwnWrite('src/ui/root.tsx')).toBe(true);
      expect(isOwnWrite('./src/ui/root.tsx')).toBe(true);
    });

    it('should not match a different file that merely shares a suffix', () => {
      expect(isOwnWrite('/scene/src/ui/other-root.tsx')).toBe(false);
      expect(isOwnWrite('/scene/src/index.ts')).toBe(false);
    });

    it('should keep matching while the bundler may still name it', () => {
      vi.advanceTimersByTime(9_999);

      expect(isOwnWrite('/scene/src/ui/root.tsx')).toBe(true);
    });

    it('should forget the write once the window has passed', () => {
      vi.advanceTimersByTime(10_000);

      expect(isOwnWrite('/scene/src/ui/root.tsx')).toBe(false);
    });
  });
});
