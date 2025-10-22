import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { setUser } from '@sentry/electron/renderer';
import { ChainId, type Avatar } from '@dcl/schemas';
import { AuthServerProvider } from 'decentraland-connect';
import { useDispatch } from '#store';
import { config } from '/@/config';
import { Profiles } from '/@/lib/profile';
import { fetchENSList } from '/@/modules/store/ens';
import { fetchLandList, fetchTiles } from '/@/modules/store/land';
import { identify } from '/@/modules/store/analytics';
import { AuthContext } from '/@/contexts/AuthContext';
import type { AuthSignInProps } from './types';

// Initialize the provider
AuthServerProvider.setAuthServerUrl(config.get('AUTH_SERVER_URL'));
AuthServerProvider.setAuthDappUrl(config.get('AUTH_DAPP_URL'));

const DEFAULT_CHAIN_ID: ChainId = (config.get('CHAIN_ID') ??
  ChainId.ETHEREUM_MAINNET) as unknown as ChainId;

export const provider = new AuthServerProvider();

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const initSignInResultRef = useRef<AuthSignInProps>();
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
    }
  }, []);

  const signIn = useCallback(async () => {
    const initSignInResult = await AuthServerProvider.initSignIn();
    initSignInResultRef.current = initSignInResult;
    navigate('/sign-in');
    AuthServerProvider.finishSignIn(initSignInResult)
      .then(finishSignIn)
      .catch(error => {
        console.error(error);
      })
      .finally(() => {
        initSignInResultRef.current = undefined;
        navigate(-1);
      });
  }, []);

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
  }, [wallet, chainId]);

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
