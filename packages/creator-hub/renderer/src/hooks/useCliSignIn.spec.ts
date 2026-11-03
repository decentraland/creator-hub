import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('/@/modules/store/translation/utils', async importOriginal => ({
  ...((await importOriginal()) as object),
  t: (id: string) => id,
}));

const { ai } = await import('#preload');
const { useCliSignIn } = await import('./useCliSignIn');

function pendingSignIn() {
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((_, r) => (reject = r));
  return { promise, reject };
}

describe('useCliSignIn', () => {
  beforeEach(() => {
    vi.mocked(ai.cancelSignInCli).mockResolvedValue(undefined);
  });

  describe('when a cancelled sign-in settles after the user retried', () => {
    it('should keep showing the retry instead of the cancelled attempt’s error', async () => {
      const first = pendingSignIn();
      vi.mocked(ai.signInCli)
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(new Promise(() => {}));
      const { result } = renderHook(() => useCliSignIn('codex'));

      act(() => void result.current.start());
      act(() => result.current.cancel());
      act(() => void result.current.start());
      await act(async () => first.reject(new Error('sign-in exited with code 1')));

      expect(result.current.signIn.busy).toBe(true);
      expect(result.current.signIn.error).toBeNull();
    });
  });

  describe('when a sign-in fails without being cancelled', () => {
    it('should show the error', async () => {
      vi.mocked(ai.signInCli).mockRejectedValueOnce(new Error('Login failed: bad code'));
      const { result } = renderHook(() => useCliSignIn('codex'));

      await act(() => result.current.start());

      expect(result.current.signIn).toMatchObject({ busy: false, error: 'Login failed: bad code' });
    });
  });
});
