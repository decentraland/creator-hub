import { afterEach, describe, expect, it, vi } from 'vitest';

import { redactSecret } from './logger';
import { store } from '.';

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

describe('the app store', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when an action carrying a password is dispatched', () => {
    it('should log it without the password', () => {
      const methods = ['log', 'info', 'group', 'groupCollapsed', 'groupEnd'] as const;
      const spies = methods.map(method => vi.spyOn(console, method).mockImplementation(() => {}));

      store.dispatch({
        type: 'test/secretAction',
        meta: { arg: { options: { secret: 'abcdefg12' } } },
      });

      const logged = JSON.stringify(spies.flatMap(spy => spy.mock.calls));
      expect(logged).toContain('<redacted>');
      expect(logged).not.toContain('abcdefg12');
    });
  });
});
