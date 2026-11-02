import { describe, expect, it } from 'vitest';

import { createLineBuffer, parseSceneBuildEvents } from './bevy-realm-build-events';

describe('parseSceneBuildEvents', () => {
  describe('when the bundler names a changed file', () => {
    it('should report a rebuild event with the path as printed', () => {
      expect(
        parseSceneBuildEvents('File /scene/assets/scene/main.composite changed, rebuilding...'),
      ).toEqual([{ kind: 'rebuild', file: '/scene/assets/scene/main.composite' }]);
    });

    it('should keep a Windows path intact', () => {
      expect(
        parseSceneBuildEvents('File C:\\scenes\\demo\\src\\index.ts changed, rebuilding...'),
      ).toEqual([{ kind: 'rebuild', file: 'C:\\scenes\\demo\\src\\index.ts' }]);
    });
  });

  describe('when the bundle is written', () => {
    it('should report a bundle-saved event', () => {
      expect(parseSceneBuildEvents('Bundle saved bin/index.js')).toEqual([
        { kind: 'bundle-saved' },
      ]);
    });
  });

  describe('when the line is unrelated', () => {
    it('should report nothing', () => {
      expect(parseSceneBuildEvents('Preview server is now running')).toEqual([]);
      expect(parseSceneBuildEvents('')).toEqual([]);
    });
  });
});

describe('createLineBuffer', () => {
  describe('when a chunk carries several complete lines', () => {
    it('should return them in order, with either line ending', () => {
      const lines = createLineBuffer();

      expect(lines.push('one\r\ntwo\nthree\n')).toEqual(['one', 'two', 'three']);
    });
  });

  describe('when a build line is cut across two chunks', () => {
    it('should hold the partial back and complete it with the next chunk', () => {
      const lines = createLineBuffer();

      const first = lines.push('Type checking completed\nFile /scene/src/ind');
      const second = lines.push('ex.ts changed, rebuilding...\nBundle sav');
      const third = lines.push('ed bin/index.js\n');

      expect(first).toEqual(['Type checking completed']);
      expect(second).toEqual(['File /scene/src/index.ts changed, rebuilding...']);
      expect(third).toEqual(['Bundle saved bin/index.js']);
      expect([...second, ...third].flatMap(parseSceneBuildEvents)).toEqual([
        { kind: 'rebuild', file: '/scene/src/index.ts' },
        { kind: 'bundle-saved' },
      ]);
    });
  });

  describe('when a chunk has no line ending at all', () => {
    it('should return nothing until the line completes', () => {
      const lines = createLineBuffer();

      expect(lines.push('Bundle saved')).toEqual([]);
      expect(lines.push(' bin/index.js\n')).toEqual(['Bundle saved bin/index.js']);
    });
  });
});
