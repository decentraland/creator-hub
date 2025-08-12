import type { Page } from 'playwright';
import { ethers } from 'ethers';
import { Authenticator, type AuthIdentity } from '@dcl/crypto';

/**
 * Creates an auth identity for E2E tests with a valid authChain
 * @param config Configuration options for the auth identity
 * @returns AuthIdentity object containing wallet, authChain, and related data
 */
export const createAuthIdentity = async (): Promise<AuthIdentity> => {
  const privateKey = process.env.E2E_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error(
      'Private key is required. Set E2E_PRIVATE_KEY environment variable or pass it in config.',
    );
  }

  const TEN_MINUTES = parseInt(process.env.E2E_EXPIRATION_MINUTES || '10', 10);

  const wallet = new ethers.Wallet(privateKey);

  const ephemeralWallet = ethers.Wallet.createRandom();
  const ephemeralIdentity = {
    address: ephemeralWallet.address,
    privateKey: ephemeralWallet.privateKey,
    publicKey: ephemeralWallet.publicKey,
  };

  // Create AuthIdentity
  const authIdentity = await Authenticator.initializeAuthChain(
    wallet.address,
    ephemeralIdentity,
    TEN_MINUTES,
    (message: string) => wallet.signMessage(message),
  );

  return authIdentity;
};

/**
 * Stores the auth identity in the browser's localStorage
 * @param page Playwright Page object
 * @param authIdentity AuthIdentity object to store
 */
export const storeAuthIdentity = async (page: Page, authIdentity: AuthIdentity): Promise<void> => {
  const walletAddress = Authenticator.ownerAddress(authIdentity.authChain);
  const storageKey = `single-sign-on-${walletAddress.toLowerCase()}`;

  await page.evaluate(
    ({ key, authIdentity }) => {
      localStorage.setItem(key, JSON.stringify(authIdentity));
    },
    { key: storageKey, authIdentity: authIdentity },
  );
};

/**
 * Creates and stores an auth identity in one operation
 * @param page Playwright Page object
 * @param config Configuration options for the auth identity
 * @returns AuthIdentity object that was created and stored
 */
export const createAndStoreAuthIdentity = async (page: Page): Promise<AuthIdentity> => {
  const authIdentity = await createAuthIdentity();
  await storeAuthIdentity(page, authIdentity);
  return authIdentity;
};
