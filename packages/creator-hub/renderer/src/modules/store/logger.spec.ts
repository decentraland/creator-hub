import { describe, expect, it } from 'vitest';

import { redactSecret } from './logger';

describe('redactSecret', () => {
  describe('when an action carries a password in its thunk argument', () => {
    it('should hide the password and keep the rest', () => {
      const action = {
        type: 'management/updateWorldPermissions/pending',
        meta: { arg: { worldName: 'plaza.dcl.eth', options: { secret: 'abcdefg12' } } },
      };

      expect(redactSecret(action)).toEqual({
        type: 'management/updateWorldPermissions/pending',
        meta: { arg: { worldName: 'plaza.dcl.eth', options: { secret: '<redacted>' } } },
      });
      expect(action.meta.arg.options.secret).toBe('abcdefg12');
    });
  });

  describe('when an action carries no password', () => {
    it('should pass it through untouched', () => {
      const action = { type: 'management/fetchWorldPermissions/pending', meta: { arg: {} } };

      expect(redactSecret(action)).toBe(action);
    });
  });
});
