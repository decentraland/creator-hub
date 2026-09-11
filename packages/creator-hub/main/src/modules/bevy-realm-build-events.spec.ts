import { describe, expect, it } from 'vitest';

import { BUILD_EVENT_PATTERN, parseSceneBuildEvents } from './bevy-realm-build-events';

describe('parseSceneBuildEvents', () => {
  describe('when the bundler names a changed file', () => {
    it('should report a rebuild event with the path as printed', () => {
      const chunk = 'File /scene/assets/scene/main.composite changed, rebuilding...\n';

      expect(parseSceneBuildEvents(chunk)).toEqual([
        { kind: 'rebuild', file: '/scene/assets/scene/main.composite' },
      ]);
    });

    it('should keep a Windows path intact', () => {
      const chunk = 'File C:\\scenes\\demo\\src\\index.ts changed, rebuilding...';

      expect(parseSceneBuildEvents(chunk)).toEqual([
        { kind: 'rebuild', file: 'C:\\scenes\\demo\\src\\index.ts' },
      ]);
    });
  });

  describe('when the bundle is written', () => {
    it('should report a bundle-saved event', () => {
      expect(parseSceneBuildEvents('Bundle saved bin/index.js\n')).toEqual([
        { kind: 'bundle-saved' },
      ]);
    });
  });

  describe('when a chunk carries several lines', () => {
    it('should report every event in order and skip unrelated lines', () => {
      const chunk = [
        'File /scene/src/index.ts changed, rebuilding...',
        'File /scene/assets/scene/main.composite changed, rebuilding...',
        'Type checking completed without errors',
        'Bundle saved bin/index.js',
      ].join('\r\n');

      expect(parseSceneBuildEvents(chunk)).toEqual([
        { kind: 'rebuild', file: '/scene/src/index.ts' },
        { kind: 'rebuild', file: '/scene/assets/scene/main.composite' },
        { kind: 'bundle-saved' },
      ]);
    });
  });

  describe('when a chunk has no build lines', () => {
    it('should report nothing and not match the subscription pattern', () => {
      const chunk = 'Preview server is now running\n';

      expect(parseSceneBuildEvents(chunk)).toEqual([]);
      expect(BUILD_EVENT_PATTERN.test(chunk)).toBe(false);
    });
  });
});
