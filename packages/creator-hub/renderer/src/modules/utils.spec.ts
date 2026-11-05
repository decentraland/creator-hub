import { describe, expect, it, vi } from 'vitest';

import { env } from '#preload';

import { getSceneJumpInDeeplink } from './utils';

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
