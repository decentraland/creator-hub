import { useCallback, useRef, useState } from 'react';

import type { AiProvider } from '/shared/types/ai';

import { ai as aiPreload } from '#preload';
import { t } from '/@/modules/store/translation/utils';

export interface CliSignInState {
  busy: boolean;
  message: string;
  url: string | null;
  /** Whether the login also takes the code shown by `url`'s page. */
  acceptsCode: boolean;
  error: string | null;
}

const IDLE: CliSignInState = {
  busy: false,
  message: '',
  url: null,
  acceptsCode: false,
  error: null,
};

// Drives a provider CLI login: it streams the auth URL/status while `<provider> login` runs, and
// resets cleanly when the user cancels (the kill rejects the promise, so an expected cancel must
// not surface as a scary "exited with code" error). Shared by the chat setup card and the
// settings "Connect" section so both behave identically.
export function useCliSignIn(provider: AiProvider, onSignedIn?: () => void) {
  const [signIn, setSignIn] = useState<CliSignInState>(IDLE);
  // Bumped by every start and cancel: a cancelled attempt still settles later (the kill rejects
  // it, or npm finishes first), and must neither surface a scary "exited with code" error nor
  // reset the state of a retry the user started meanwhile.
  const attempt = useRef(0);

  const start = useCallback(async () => {
    const mine = ++attempt.current;
    setSignIn({ ...IDLE, busy: true, message: t('editor.ai.setup.signin_starting') });
    try {
      await aiPreload.signInCli(provider, event => {
        if (attempt.current !== mine) return;
        setSignIn(s =>
          event.type === 'auth'
            ? {
                ...s,
                url: event.url,
                acceptsCode: event.acceptsCode,
                message: t('editor.ai.setup.signin_browser'),
              }
            : { ...s, message: event.message },
        );
      });
      if (attempt.current !== mine) return;
      setSignIn(IDLE);
      onSignedIn?.();
    } catch (e) {
      if (attempt.current !== mine) return;
      setSignIn({ ...IDLE, error: e instanceof Error ? e.message : String(e) });
    }
  }, [provider, onSignedIn]);

  const cancel = useCallback(() => {
    attempt.current++;
    void aiPreload.cancelSignInCli();
    setSignIn(IDLE);
  }, []);

  const submitCode = useCallback((code: string) => {
    void aiPreload.submitSignInCode(code);
  }, []);

  return { signIn, start, cancel, submitCode };
}
