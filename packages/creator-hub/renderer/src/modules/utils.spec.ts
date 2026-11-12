import { beforeEach, describe, expect, it, vi } from 'vitest';

import { env } from '#preload';

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

const { getJumpInUrl, getSceneJumpInDeeplink, getSceneJumpInUrl, isValidContact, parseContact } =
  await import('./utils');

describe('parseContact', () => {
  describe.each([
    ['fixture_user', { method: 'discord', value: 'fixture_user' }, true],
    ['@Fixture_User', { method: 'discord', value: 'fixture_user' }, true],
    ['fixture..user', { method: 'discord', value: 'fixture..user' }, false],
    [' jane.doe@example.com ', { method: 'email', value: 'jane.doe@example.com' }, true],
    ['jane.doe@', { method: 'email', value: 'jane.doe@' }, false],
  ])('when the input is "%s"', (input, contact, valid) => {
    it(`should read it as a ${valid ? 'valid' : 'invalid'} ${contact.method} contact`, () => {
      const parsed = parseContact(input);
      expect(parsed).toEqual(contact);
      expect(isValidContact(parsed!)).toBe(valid);
    });
  });

  describe('when the input is blank', () => {
    it('should return no contact', () => {
      expect(parseContact('   ')).toBeUndefined();
    });
  });
});

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

describe('getSceneJumpInDeeplink', () => {
  describe('when the scene is in Genesis City', () => {
    it('should jump to its position', () => {
      vi.mocked(env.getEnv).mockReturnValue('prd' as never);

      expect(getSceneJumpInDeeplink({ x: 23, y: -14 })).toBe(
        'decentraland://?position=23,-14&dclenv=org',
      );
    });
  });

  describe('when the scene is in a World', () => {
    it('should jump to the World alone by default', () => {
      vi.mocked(env.getEnv).mockReturnValue('dev' as never);

      expect(getSceneJumpInDeeplink({ world: 'example-world.dcl.eth', x: 2, y: 1 })).toBe(
        'decentraland://?realm=example-world.dcl.eth&dclenv=zone',
      );
    });

    it('should jump to the scene itself when asked for its position', () => {
      vi.mocked(env.getEnv).mockReturnValue('prd' as never);

      expect(
        getSceneJumpInDeeplink({ world: 'example-world.dcl.eth', x: 2, y: 1 }, { position: true }),
      ).toBe('decentraland://?realm=example-world.dcl.eth&position=2,1&dclenv=org');
    });
  });
});
