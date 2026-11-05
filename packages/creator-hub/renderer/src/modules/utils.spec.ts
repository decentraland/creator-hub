import { beforeEach, describe, expect, it, vi } from 'vitest';

const CONFIGS = {
  dev: {
    ENVIRONMENT: 'development',
    JUMP_URL: 'https://decentraland.zone/jump',
    WORLDS_CONTENT_SERVER_URL: 'https://worlds-content-server.decentraland.zone',
  },
  prd: {
    ENVIRONMENT: 'production',
    JUMP_URL: 'https://decentraland.org/jump',
    WORLDS_CONTENT_SERVER_URL: 'https://worlds-content-server.decentraland.org',
  },
};
let current: Record<string, string> = CONFIGS.dev;

vi.mock('/@/config', () => ({ config: { get: (key: string) => current[key] ?? '' } }));

const { getJumpInUrl, getSceneJumpInUrl } = await import('./utils');

describe('jump-in web URLs', () => {
  describe('when the config is dev', () => {
    beforeEach(() => {
      current = CONFIGS.dev;
    });

    it('should jump to a World through the zone, on its dev realm', () => {
      expect(getJumpInUrl('plaza.dcl.eth')).toBe(
        'https://decentraland.zone/jump?realm=https://worlds-content-server.decentraland.zone/world/plaza.dcl.eth&NETWORK=sepolia',
      );
    });

    it('should jump to a position through the zone', () => {
      expect(getSceneJumpInUrl({ x: 15, y: 2 })).toBe(
        'https://decentraland.zone/jump?position=15,2',
      );
    });
  });

  describe('when the config is prd', () => {
    beforeEach(() => {
      current = CONFIGS.prd;
    });

    it('should jump to a World through .org by its name', () => {
      expect(getJumpInUrl('plaza.dcl.eth')).toBe(
        'https://decentraland.org/jump?realm=plaza.dcl.eth',
      );
      expect(getSceneJumpInUrl({ world: 'plaza.dcl.eth', x: 0, y: 0 })).toBe(
        'https://decentraland.org/jump?realm=plaza.dcl.eth',
      );
    });

    it('should jump to a position through .org', () => {
      expect(getSceneJumpInUrl({ x: -3, y: 7 })).toBe(
        'https://decentraland.org/jump?position=-3,7',
      );
    });
  });
});
