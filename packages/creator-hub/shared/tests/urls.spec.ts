import { describe, expect, it } from 'vitest';

import { buildMetricsUrl } from '../urls';

describe('buildMetricsUrl', () => {
  const base = 'https://places.decentraland.org/v1';

  describe('when joining a base with a path', () => {
    it('should keep the base path segment', () => {
      expect(buildMetricsUrl(base, '/metrics').toString()).toBe(
        'https://places.decentraland.org/v1/metrics',
      );
    });

    it('should join the same way regardless of surrounding slashes', () => {
      const expected = 'https://places.decentraland.org/v1/metrics';
      expect(buildMetricsUrl(base, 'metrics').toString()).toBe(expected);
      expect(buildMetricsUrl(`${base}/`, '/metrics').toString()).toBe(expected);
      expect(buildMetricsUrl(`${base}/`, 'metrics').toString()).toBe(expected);
    });

    it('should resolve a protocol-relative path under the base host', () => {
      expect(buildMetricsUrl(base, '//evil.example.com/metrics').host).toBe(
        'places.decentraland.org',
      );
    });
  });

  describe('when the path is an absolute URL', () => {
    it('should reject it rather than let it replace the base host', () => {
      expect(() => buildMetricsUrl(base, 'https://evil.example.com/metrics')).toThrow(
        /must be a relative path/,
      );
    });

    it('should reject any scheme, not just http ones', () => {
      expect(() => buildMetricsUrl(base, 'javascript:alert(1)')).toThrow(/must be a relative path/);
      expect(() => buildMetricsUrl(base, 'file:///etc/passwd')).toThrow(/must be a relative path/);
    });
  });
});
