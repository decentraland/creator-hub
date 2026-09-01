import { describe, it, expect } from 'vitest';

import { sanitizePreviewError } from './utils';

describe('sanitizePreviewError', () => {
  describe('when the output contains an esbuild diagnostic (#1464)', () => {
    it('should keep only the diagnostic line, dropping the stack, paths, and CLI text', () => {
      const raw = [
        'Building scene...',
        'src/index.ts:9:2: ERROR: Unexpected "}"',
        '    at failureErrorWithLog (/Users/someone/proj/node_modules/esbuild/lib/main.js:1650:15)',
        '    at /Users/someone/proj/node_modules/esbuild/lib/main.js:1059:25',
        'Developer: All errors thrown must be an instance of "CliError".',
      ].join('\n');

      const result = sanitizePreviewError(raw);

      expect(result).toBe('src/index.ts:9:2 — Unexpected "}"');
      expect(result).not.toContain('node_modules');
      expect(result).not.toContain('CliError');
      expect(result).not.toContain('at ');
    });

    it('should handle the Windows variant (different message, backslash paths in stack)', () => {
      const raw = [
        'src/index.ts:5:0: ERROR: Expected ")" but found "MeshRenderer"',
        '    at failureErrorWithLog (C:\\Users\\qa\\proj\\node_modules\\esbuild\\lib\\main.js:1650:15)',
        'Developer: All errors thrown must be an instance of "CliError".',
      ].join('\n');

      expect(sanitizePreviewError(raw)).toBe(
        'src/index.ts:5:0 — Expected ")" but found "MeshRenderer"',
      );
    });

    it('should strip an absolute prefix before the project-relative src/ segment', () => {
      const raw = '/Users/someone/proj/src/index.ts:3:10: ERROR: Unexpected token';
      expect(sanitizePreviewError(raw)).toBe('src/index.ts:3:10 — Unexpected token');
    });

    it('should keep multiple diagnostics but cap the list', () => {
      const raw = Array.from(
        { length: 8 },
        (_, i) => `src/index.ts:${i + 1}:0: ERROR: problem ${i + 1}`,
      ).join('\n');
      const result = sanitizePreviewError(raw);
      expect(result.split('\n')).toHaveLength(5);
      expect(result).toContain('problem 1');
      expect(result).not.toContain('problem 6');
    });
  });

  describe('when there is no esbuild diagnostic', () => {
    it('should fall back to a generic hint rather than leaking the raw output', () => {
      const raw = [
        'Error: connect ECONNREFUSED 127.0.0.1:8000',
        '    at TCPConnectWrap.afterConnect (node:net:1494:16)',
      ].join('\n');
      const result = sanitizePreviewError(raw);
      expect(result).toBe('A build error stopped the preview. Check your scene code.');
      expect(result).not.toContain('ECONNREFUSED');
    });

    it('should fall back when the message is empty or undefined', () => {
      expect(sanitizePreviewError('')).toBe(
        'A build error stopped the preview. Check your scene code.',
      );
      expect(sanitizePreviewError(undefined)).toBe(
        'A build error stopped the preview. Check your scene code.',
      );
    });
  });
});
