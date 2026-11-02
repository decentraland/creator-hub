import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_DEEPLINK_SIGNIN_CHANNEL } from '/shared/deeplink';
import { handleDeeplink, shouldRegisterProtocolClient } from '../src/modules/deeplink';
import { restoreOrCreateMainWindow } from '../src/mainWindow';

vi.mock('electron', () => ({
  app: {
    isReady: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../src/mainWindow', () => ({
  restoreOrCreateMainWindow: vi.fn(),
}));

const send = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(restoreOrCreateMainWindow).mockResolvedValue({
    isDestroyed: () => false,
    webContents: { send },
  } as unknown as Awaited<ReturnType<typeof restoreOrCreateMainWindow>>);
});

describe('when handling a sign-in deeplink', () => {
  describe('and the link carries the authRequestId of the sign in that was started', () => {
    it('should forward both the identityId and the authRequestId to the renderer', async () => {
      await handleDeeplink(
        'dcl-creator-hub://open?signin=anIdentityId&authRequestId=aRequestId&dclenv=zone',
      );

      expect(send).toHaveBeenCalledWith(AUTH_DEEPLINK_SIGNIN_CHANNEL, {
        identityId: 'anIdentityId',
        authRequestId: 'aRequestId',
      });
    });
  });

  describe('and the link carries no authRequestId', () => {
    it('should forward a null authRequestId so the renderer can reject the uncorrelated link', async () => {
      await handleDeeplink('dcl-creator-hub://open?signin=anIdentityId');

      expect(send).toHaveBeenCalledWith(AUTH_DEEPLINK_SIGNIN_CHANNEL, {
        identityId: 'anIdentityId',
        authRequestId: null,
      });
    });
  });

  describe('and the window is destroyed', () => {
    beforeEach(() => {
      vi.mocked(restoreOrCreateMainWindow).mockResolvedValue({
        isDestroyed: () => true,
        webContents: { send },
      } as unknown as Awaited<ReturnType<typeof restoreOrCreateMainWindow>>);
    });

    it('should not send anything to the renderer', async () => {
      await handleDeeplink('dcl-creator-hub://open?signin=anIdentityId&authRequestId=aRequestId');

      expect(send).not.toHaveBeenCalled();
    });
  });
});

describe('when handling a deeplink without a signin param', () => {
  it('should only launch the app without forwarding a sign in', async () => {
    await handleDeeplink('dcl-creator-hub://open');

    expect(restoreOrCreateMainWindow).toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('when handling a URL that is not a deeplink for our scheme', () => {
  it('should ignore it', async () => {
    await handleDeeplink('https://decentraland.org/open?signin=anIdentityId');

    expect(restoreOrCreateMainWindow).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('shouldRegisterProtocolClient', () => {
  describe('when running a packaged build', () => {
    it.each(['darwin', 'win32', 'linux'])('should claim the scheme on %s', osPlatform => {
      expect(shouldRegisterProtocolClient(false, osPlatform)).toBe(true);
    });
  });

  describe('when running a development build', () => {
    it('should not claim the scheme on macOS, where the id is the generic Electron bundle', () => {
      expect(shouldRegisterProtocolClient(true, 'darwin')).toBe(false);
    });

    it.each(['win32', 'linux'])(
      'should still claim it on %s, where the registration carries the app path',
      osPlatform => {
        expect(shouldRegisterProtocolClient(true, osPlatform)).toBe(true);
      },
    );
  });
});
