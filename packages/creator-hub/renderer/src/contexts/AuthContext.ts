import { createContext } from 'react';
import type { Avatar, ChainId } from '@dcl/schemas';

interface AuthContextProps {
  wallet: string | undefined;
  chainId: ChainId | undefined;
  avatar: Avatar | undefined;
  isSignedIn: boolean;
  isSigningIn: boolean;
  signIn: () => Promise<void>;
  cancelSignIn: () => void;
  signOut: () => void;
  changeNetwork: (chainId: ChainId) => Promise<void>;
}

export const AuthContext = createContext<AuthContextProps | undefined>(undefined);
