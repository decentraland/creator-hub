import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { setUser } from '@sentry/electron/renderer';
import { ChainId, type Avatar } from '@dcl/schemas';
import { useDispatch } from '#store';
import { config } from '/@/config';
import { AuthServerProvider } from '/@/lib/auth';
import { Profiles } from '/@/lib/profile';
import { fetchENSList } from '/@/modules/store/ens';
import { fetchLandList, fetchTiles } from '/@/modules/store/land';
import { identify } from '/@/modules/store/analytics';
import { AuthContext } from '/@/contexts/AuthContext';
import { isNavigatorOnline } from '/@/lib/connection';
import { useSnackbar } from '/@/hooks/useSnackbar';
import { t } from '/@/modules/store/translation/utils';
import type { AuthSignInProps } from './types';

AuthServerProvider.setAuthServerUrl(config.get('AUTH_SERVER_URL'));
AuthServerProvider.setAuthDappUrl(config.get('AUTH_DAPP_URL'));

const DEFAULT_CHAIN_ID: ChainId = (Number(config.get('CHAIN_ID')) ??
  ChainId.ETHEREUM_MAINNET) as ChainId;

export const provider = new AuthServerProvider();

const MAX_SIGNIN_ATTEMPTS = 3;
const SIGNIN_TIMEOUT_IN_MS = 60_000;

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { pushGeneric } = useSnackbar();
  const initSignInResultRef = useRef<AuthSignInProps>();
  const signInAttemptCountRef = useRef<number>(0);
  const activeSignInTabsRef = useRef<Set<string>>(new Set());
  const [wallet, setWallet] = useState<string>();
  const [avatar, setAvatar] = useState<Avatar>();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [chainId, setChainId] = useState<ChainId>(DEFAULT_CHAIN_ID);

  const isSigningIn = !!initSignInResultRef?.current;

  const fetchAvatar = useCallback(async (address: string) => {
    try {
      const profile = new Profiles();
      const avatar = await profile.fetchProfile(address);
      setAvatar(avatar);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const finishSignIn = useCallback(async () => {
    const hasValidIdentity = AuthServerProvider.hasValidIdentity();
    const connectedAccount = AuthServerProvider.getAccount();
    if (hasValidIdentity && connectedAccount) {
      setWallet(connectedAccount);
      setIsSignedIn(true);
      fetchAvatar(connectedAccount);
      signInAttemptCountRef.current = 0;
    }
  }, [fetchAvatar]);

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

      const initSignInPromise = AuthServerProvider.initSignIn();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Signin timeout')), SIGNIN_TIMEOUT_IN_MS);
      });

      const initSignInResult = await Promise.race([initSignInPromise, timeoutPromise]);
      initSignInResultRef.current = initSignInResult;

      const sessionId = Date.now().toString();
      activeSignInTabsRef.current.add(sessionId);

      navigate('/sign-in');

      AuthServerProvider.finishSignIn(initSignInResult)
        .then(finishSignIn)
        .catch(error => {
          console.error('Signin error:', error);
          pushGeneric('error', error?.message || t('sign_in.errors.failed'));
        })
        .finally(() => {
          initSignInResultRef.current = undefined;
          activeSignInTabsRef.current.delete(sessionId);
          navigate(-1);
        });
    } catch (error: any) {
      console.error('Signin initialization error:', error);
      pushGeneric(
        'error',
        error?.message === 'Signin timeout'
          ? t('sign_in.errors.timeout')
          : t('sign_in.errors.init_failed'),
      );
      initSignInResultRef.current = undefined;
    }
  }, [navigate, pushGeneric, finishSignIn]);

  const signOut = useCallback(() => {
    setWallet(undefined);
    setAvatar(undefined);
    setIsSignedIn(false);
    AuthServerProvider.deactivate();
  }, []);

  const changeNetwork = useCallback(async (chainId: ChainId = DEFAULT_CHAIN_ID) => {
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: Number(chainId).toString(16) }],
      });
      setChainId(chainId);
    } catch (error) {
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
    if (wallet && chainId) {
      dispatch(fetchENSList({ address: wallet, chainId }));
      dispatch(identify({ userId: wallet }));
      dispatch(fetchTiles());
      dispatch(fetchLandList({ address: wallet }));
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
        verificationCode: initSignInResultRef.current?.requestResponse.code,
        expirationTime: initSignInResultRef.current?.requestResponse.expiration,
        isSignedIn,
        isSigningIn,
        signIn,
        signOut,
        changeNetwork,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
