import { describe, expect, it, vi } from 'vitest';

import { env } from '#preload';

import dev from './env/dev.json';

describe('config', () => {
  describe('when the preload reports an API URL override', () => {
    it('should resolve that key to the override and leave the others alone', async () => {
      vi.mocked(env.getEnv).mockReturnValue('dev' as never);
      vi.mocked(env.getApiUrlOverrides).mockReturnValue({
        CREATOR_FUND_API_URL: 'http://localhost:8788',
      });

      const { config } = await import('.');

      expect(config.get('CREATOR_FUND_API_URL')).toBe('http://localhost:8788');
      expect(config.get('METRICS_API_URL')).toBe(dev.METRICS_API_URL);
    });
  });
});
