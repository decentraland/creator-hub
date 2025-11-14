import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { setUser } from '@sentry/electron/renderer';
import { ChainId, type Avatar } from '@dcl/schemas';
import { useDispatch } from '#store';
import { identify } from '/@/modules/store/analytics';
import { fetchENSList } from '/@/modules/store/ens';
import { fetchLandList, fetchTiles } from '/@/modules/store/land';
import Profiles from '/@/lib/profile';
import { AuthContext } from '/@/contexts/AuthContext';
import type { AuthSignInProps } from '../types';

// Mock methods for testing - now using a factory function to create isolated instances
const createMockAuthServerProvider = () => {
  // Mock authentication state - now encapsulated within the provider
  let mockIsAuthenticated = false;
  let mockAccount = process.env.E2E_WALLET || null;

  return {
    setAuthServerUrl: (_url: string) => {
      // setAuthServerUrl called
    },
    setAuthDappUrl: (_url: string) => {
      // setAuthDappUrl called
    },
    setIdentityExpiration: (_millis: number) => {
      // setIdentityExpiration called
    },
    setOpenBrowser: (_openBrowser: any) => {
      // setOpenBrowser called
    },
    initSignIn: async (): Promise<AuthSignInProps> => {
      // initSignIn called
      return {
        socket: { on: () => {}, emit: () => {}, disconnect: () => {} } as any,
        ephemeralAccount: { address: mockAccount } as any,
        expiration: new Date(Date.now() + 600000),
        ephemeralMessage: 'mock-message',
        requestResponse: {
          code: 'MOCK_VERIFICATION_CODE',
          expiration: new Date(Date.now() + 600000).toISOString(),
        },
      };
    },
    finishSignIn: async (_result: AuthSignInProps): Promise<void> => {
      // finishSignIn called
      await new Promise(resolve => setTimeout(resolve, 1000));
      mockIsAuthenticated = true;
    },
    getAccount: (): string | null => {
      // getAccount called
      return mockIsAuthenticated ? mockAccount : null;
    },
    deactivate: (): void => {
      // deactivate called
      mockIsAuthenticated = false;
    },
    hasValidIdentity: (): boolean => {
      // hasValidIdentity called
      return mockIsAuthenticated;
    },
    // Test helper methods
    setMockAuthenticated: (authenticated: boolean): void => {
      mockIsAuthenticated = authenticated;
    },
    setMockAccount: (account: string): void => {
      mockAccount = account;
    },
    getMockState: (): { isAuthenticated: boolean; account: string | null } => {
      return {
        isAuthenticated: mockIsAuthenticated,
        account: mockIsAuthenticated ? mockAccount : null,
      };
    },
  };
};

// Create a singleton instance for global access in tests
export const MockAuthServerProvider = createMockAuthServerProvider();

// Make MockAuthServerProvider available globally for tests
if (typeof window !== 'undefined') {
  (window as any).MockAuthServerProvider = MockAuthServerProvider;
}

export const MockAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const initSignInResultRef = useRef<AuthSignInProps>();
  const [wallet, setWallet] = useState<string>();
  const [avatar, setAvatar] = useState<Avatar>();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [chainId, setChainId] = useState<ChainId>(ChainId.ETHEREUM_SEPOLIA);

  const isSigningIn = !!initSignInResultRef?.current;

  const fetchAvatar = useCallback(async (address: string) => {
    try {
      const avatar = await Profiles.fetchProfile(address);
      setAvatar(avatar);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const finishSignIn = useCallback(async () => {
    const hasValidIdentity = MockAuthServerProvider.hasValidIdentity();
    const connectedAccount = MockAuthServerProvider.getAccount();

    if (hasValidIdentity && connectedAccount) {
      setWallet(connectedAccount);
      setIsSignedIn(true);
      fetchAvatar(connectedAccount);
    }
  }, []);

  const signIn = useCallback(async () => {
    const initSignInResult = await MockAuthServerProvider.initSignIn();
    initSignInResultRef.current = initSignInResult;
    navigate('/sign-in');
    MockAuthServerProvider.finishSignIn(initSignInResult)
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
    MockAuthServerProvider.deactivate();
  }, []);

  const changeNetwork = useCallback(async (chainId: ChainId = ChainId.ETHEREUM_SEPOLIA) => {
    try {
      // Mock network change
      setChainId(chainId);
    } catch (error) {
      setChainId(ChainId.ETHEREUM_SEPOLIA);
      console.error(error);
    }
  }, []);

  useEffect(() => {
    const hasValidIdentity = MockAuthServerProvider.hasValidIdentity();
    const connectedAccount = MockAuthServerProvider.getAccount();
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
