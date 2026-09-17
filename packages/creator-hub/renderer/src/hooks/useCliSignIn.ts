import { useCallback, useRef, useState } from 'react';

import type { AiProvider } from '/shared/types/ai';

import { ai as aiPreload } from '#preload';
import { t } from '/@/modules/store/translation/utils';

export interface CliSignInState {
  busy: boolean;
  message: string;
  url: string | null;
  error: string | null;
}

const IDLE: CliSignInState = { busy: false, message: '', url: null, error: null };

// Drives a provider CLI login: it streams the auth URL/status while `<provider> login` runs, and
// resets cleanly when the user cancels (the kill rejects the promise, so an expected cancel must
// not surface as a scary "exited with code" error). Shared by the chat setup card and the
// settings "Connect" section so both behave identically.
export function useCliSignIn(provider: AiProvider, onSignedIn?: () => void) {
  const [signIn, setSignIn] = useState<CliSignInState>(IDLE);
  const cancelled = useRef(false);

  const start = useCallback(async () => {
    cancelled.current = false;
    setSignIn({
      busy: true,
      message: t('editor.ai.setup.signin_starting'),
      url: null,
      error: null,
    });
    try {
      await aiPreload.signInCli(provider, event => {
        setSignIn(s =>
          event.type === 'auth'
            ? { ...s, url: event.url, message: t('editor.ai.setup.signin_browser') }
            : { ...s, message: event.message },
        );
      });
      setSignIn(IDLE);
      onSignedIn?.();
    } catch (e) {
      setSignIn({
        busy: false,
        message: '',
        url: null,
        error: cancelled.current ? null : e instanceof Error ? e.message : String(e),
      });
    }
  }, [provider, onSignedIn]);

  const cancel = useCallback(() => {
    cancelled.current = true;
    void aiPreload.cancelSignInCli();
    setSignIn(IDLE);
  }, []);

  return { signIn, start, cancel };
}
