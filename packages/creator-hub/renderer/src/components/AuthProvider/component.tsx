import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { captureException, setUser } from '@sentry/electron/renderer';
import { ChainId, type Avatar } from '@dcl/schemas';
import { useDispatch } from '#store';
import { analytics, auth, misc } from '#preload';
import { config } from '/@/config';
import { AuthServerProvider, SignInError } from '/@/lib/auth';
import { Profiles } from '/@/lib/profile';
import { fetchTiles } from '/@/modules/store/land';
import {
  fetchAllManagedProjectsData,
  actions as managementActions,
} from '/@/modules/store/management';
import { actions as ensActions } from '/@/modules/store/ens';
import { identify } from '/@/modules/store/analytics';
import { AuthContext } from '/@/contexts/AuthContext';
import { isNavigatorOnline } from '/@/lib/connection';
import { useSnackbar } from '/@/hooks/useSnackbar';
import { t } from '/@/modules/store/translation/utils';

AuthServerProvider.setAuthServerUrl(config.get('AUTH_SERVER_URL'));
AuthServerProvider.setAuthDappUrl(config.get('AUTH_DAPP_URL'));

const DEFAULT_CHAIN_ID: ChainId = (Number(config.get('CHAIN_ID')) ||
  ChainId.ETHEREUM_MAINNET) as ChainId;

export const provider = new AuthServerProvider();

const MAX_SIGNIN_ATTEMPTS = 3;

function signInErrorMessage(error: unknown): string {
  if (error instanceof SignInError) {
    switch (error.reason) {
      case 'not_found':
        return t('sign_in.errors.identity_not_found');
      case 'expired':
        return t('sign_in.errors.identity_expired');
      case 'network':
        return t('sign_in.errors.network_mismatch');
    }
  }
  return t('sign_in.errors.failed');
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { pushGeneric } = useSnackbar();
  const signInAttemptCountRef = useRef<number>(0);
  const deepLinkCleanupRef = useRef<(() => void) | null>(null);
  const requestIdRef = useRef<string | null>(null);

  const [wallet, setWallet] = useState<string>();
  const [avatar, setAvatar] = useState<Avatar>();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [chainId, setChainId] = useState<ChainId>(DEFAULT_CHAIN_ID);

  const fetchAvatar = useCallback(async (address: string) => {
    try {
      const profile = new Profiles();
      const avatar = await profile.fetchProfile(address);
      setAvatar(avatar);
    } catch (error) {
      console.error(error);
    }
  }, []);

  // Stops listening for the deep-link sign-in of the current attempt, if any.
  const stopDeepLinkListener = useCallback(() => {
    deepLinkCleanupRef.current?.();
    deepLinkCleanupRef.current = null;
  }, []);

  const finishSignIn = useCallback(
    async (identityId: string) => {
      // This only runs while a sign in is in progress (the listener is scoped to
      // the attempt), so we are always on the sign-in page here.
      try {
        const signer = await AuthServerProvider.applyDeepLinkIdentity(identityId);
        setWallet(signer);
        setIsSignedIn(true);
        fetchAvatar(signer);
        signInAttemptCountRef.current = 0;
        void analytics.track('Sign In Completed', { method: 'deeplink' });
      } catch (error) {
        captureException(error, {
          tags: { source: 'auth', event: 'signin-deeplink' },
        });
        console.error('Signin error:', error);
        pushGeneric('error', signInErrorMessage(error));
      } finally {
        setIsSigningIn(false);
        navigate(-1);
      }
    },
    [fetchAvatar, navigate, pushGeneric],
  );

  const signIn = useCallback(async () => {
    if (!isNavigatorOnline()) {
      pushGeneric('error', t('connection.offline.message'));
      return;
    }

    if (signInAttemptCountRef.current >= MAX_SIGNIN_ATTEMPTS) {
      pushGeneric('error', t('sign_in.errors.max_attempts'));
      return;
    }

    try {
      signInAttemptCountRef.current += 1;
      setIsSigningIn(true);

      // Listen for the deep link that completes this attempt. Scoped to the
      // attempt: it fires once, then unsubscribes (also on cancel/re-entry).
      stopDeepLinkListener();
      const { cleanup } = auth.onDeepLinkSignIn(identityId => {
        stopDeepLinkListener();
        void finishSignIn(identityId);
      });
      deepLinkCleanupRef.current = cleanup;

      const requestId = await AuthServerProvider.createSignInRequest();
      requestIdRef.current = requestId;
      navigate('/sign-in');
      AuthServerProvider.openAuthDapp(requestId, true);
    } catch (error: any) {
      stopDeepLinkListener();
      captureException(error, {
        tags: { source: 'auth', event: 'signin-init' },
      });
      console.error('Signin initialization error:', error);
      pushGeneric('error', t('sign_in.errors.init_failed'));
      setIsSigningIn(false);
    }
  }, [navigate, pushGeneric, finishSignIn, stopDeepLinkListener]);

  const cancelSignIn = useCallback(() => {
    stopDeepLinkListener();
    requestIdRef.current = null;
    setIsSigningIn(false);
  }, [stopDeepLinkListener]);

  // Re-opens the auth dapp for the in-progress sign in, e.g. if the browser
  // failed to open the first time. Safe no-op if there is no active request.
  const reopenSignInDapp = useCallback(() => {
    if (requestIdRef.current) {
      AuthServerProvider.openAuthDapp(requestIdRef.current, true);
    }
  }, []);

  // Copies the auth dapp URL for the in-progress sign in to the clipboard so the
  // user can open it manually if the app cannot launch the browser. No-op when
  // there is no active request.
  const copySignInUrl = useCallback(async () => {
    if (!requestIdRef.current) return;
    const url = AuthServerProvider.getAuthDappUrl(requestIdRef.current, true);
    await misc.copyToClipboard(url);
    pushGeneric('success', t('snackbar.generic.url_copied'));
  }, [pushGeneric]);

  const signOut = useCallback(() => {
    setWallet(undefined);
    setAvatar(undefined);
    setIsSignedIn(false);
    AuthServerProvider.deactivate();
    dispatch(managementActions.clearUserManagedProjects());
  }, []);

  const changeNetwork = useCallback(async (chainId: ChainId = DEFAULT_CHAIN_ID) => {
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: Number(chainId).toString(16) }],
      });
      setChainId(chainId);
    } catch (error) {
      captureException(error, {
        tags: { source: 'auth', event: 'chain-switch' },
      });
      setChainId(DEFAULT_CHAIN_ID);
      console.error(error);
    }
  }, []);

  useEffect(() => {
    const hasValidIdentity = AuthServerProvider.hasValidIdentity();
    const connectedAccount = AuthServerProvider.getAccount();
    if (hasValidIdentity && connectedAccount) {
      setWallet(connectedAccount);
      setIsSignedIn(true);
      fetchAvatar(connectedAccount);
    }
  }, []);

  useEffect(() => {
    return () => stopDeepLinkListener();
  }, [stopDeepLinkListener]);

  useEffect(() => {
    if (wallet && chainId) {
      dispatch(ensActions.setChainId(chainId));
      dispatch(fetchAllManagedProjectsData({ address: wallet }));
      dispatch(identify({ userId: wallet }));
      dispatch(fetchTiles());
      setUser({ id: wallet });
    }
  }, [wallet, chainId, dispatch]);

  useEffect(() => {
    const handleOnline = () => {
      signInAttemptCountRef.current = 0;
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  useEffect(() => {
    const resetInterval = setInterval(
      () => {
        if (signInAttemptCountRef.current > 0) {
          signInAttemptCountRef.current = 0;
        }
      },
      5 * 60 * 1000,
    );

    return () => clearInterval(resetInterval);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        wallet,
        avatar,
        chainId,
        isSignedIn,
        isSigningIn,
        signIn,
        cancelSignIn,
        reopenSignInDapp,
        copySignInUrl,
        signOut,
        changeNetwork,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
