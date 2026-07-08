import { createPublicClient, http } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { type Socket, io } from 'socket.io-client';
import { ChainId, ProviderType } from '@dcl/schemas';
import { Authenticator, type AuthIdentity, type AuthChain } from '@dcl/crypto';
import * as sso from '@dcl/single-sign-on-client';
import { analytics } from '#preload';

const STORAGE_KEY_ADDRESS = 'auth-server-provider-address';
const STORAGE_KEY_CHAIN_ID = 'auth-server-provider-chain-id';

type Payload = {
  method: string;
  params: any[];
};

/**
 * Reason a deep-link sign in failed, used to surface a translated message.
 */
export type SignInErrorReason = 'not_found' | 'expired' | 'network' | 'unknown';

/**
 * Error thrown while fetching/applying a deep-link sign in identity. Carries a
 * `reason` so the UI can map it to a translated, actionable message.
 */
export class SignInError extends Error {
  constructor(
    readonly reason: SignInErrorReason,
    message: string,
  ) {
    super(message);
    this.name = 'SignInError';
  }
}

export type OutcomeError = {
  code: number;
  message: string;
  data?: any;
};

export function getRpcUrls(providerType: ProviderType) {
  const rpcUrls = {
    [ChainId.ETHEREUM_MAINNET]: 'https://rpc.decentraland.org/mainnet',
    [ChainId.ETHEREUM_SEPOLIA]: 'https://rpc.decentraland.org/sepolia',
    [ChainId.MATIC_MAINNET]: 'https://rpc.decentraland.org/polygon',
    [ChainId.MATIC_AMOY]: 'https://rpc.decentraland.org/amoy',
    [ChainId.ARBITRUM_MAINNET]: 'https://rpc.decentraland.org/arbitrum',
    [ChainId.OPTIMISM_MAINNET]: 'https://rpc.decentraland.org/optimism',
    [ChainId.AVALANCHE_MAINNET]: 'https://rpc.decentraland.org/avalanche',
    [ChainId.BSC_MAINNET]: 'https://rpc.decentraland.org/binance',
    [ChainId.FANTOM_MAINNET]: 'https://rpc.decentraland.org/fantom',
  };

  let project = '';

  switch (providerType) {
    case ProviderType.AUTH_SERVER:
    default:
      project = 'auth-server';
      break;
  }

  if (project) {
    for (const chainId in rpcUrls) {
      const key = chainId as unknown as keyof typeof rpcUrls;
      rpcUrls[key] += `?project=${project}`;
    }
  }

  return rpcUrls;
}

function isRPCError(outcome: unknown): outcome is OutcomeError {
  return (
    typeof outcome === 'object' &&
    outcome !== undefined &&
    outcome !== null &&
    'message' in outcome &&
    'code' in outcome
  );
}

function isErrorWithMessage(error: unknown): error is Error {
  return typeof error === 'object' && error !== undefined && error !== null && 'message' in error;
}

export class AuthServerProvider {
  private static authServerUrl: string = '';
  private static authDappUrl: string = '';
  private static identityExpirationInMillis: number = 30 * 24 * 60 * 60 * 1000; // 30 days in the future.
  private static openBrowser: (url: string, target?: string, features?: string) => void;

  /**
   * Set the url of the auth server to be consumed by this provider.
   */
  static setAuthServerUrl(url: string) {
    AuthServerProvider.authServerUrl = url;
  }

  /**
   * Set the url of the auth dapp to be consumed by this provider.
   */
  static setAuthDappUrl(url: string) {
    AuthServerProvider.authDappUrl = url;
  }

  /**
   * Set the time it will take for the ephemeral message used on sign in to expire.
   */
  static setIdentityExpiration(millis: number) {
    AuthServerProvider.identityExpirationInMillis = millis;
  }

  /**
   * Set the function that will be used to open the browser.
   */
  static setOpenBrowser(openBrowser: (url: string, target?: string, features?: string) => void) {
    AuthServerProvider.openBrowser = openBrowser;
  }

  /**
   * Creates an auth request and returns its id.
   * An ephemeral key pair is generated only to form the `dcl_personal_sign`
   * request body; the identity fetched on completion is self-contained, so this
   * local key pair is not reused.
   */
  static createSignInRequest = async (): Promise<string> => {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const expiration = new Date(Date.now() + AuthServerProvider.identityExpirationInMillis);
    const ephemeralMessage = Authenticator.getEphemeralMessage(account.address, expiration);

    const response = await fetch(`${AuthServerProvider.authServerUrl}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'dcl_personal_sign', params: [ephemeralMessage] }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create auth request (${response.status})`);
    }

    const { requestId } = await response.json();
    return requestId;
  };

  /**
   * Fetches a stored identity by its id (delivered via deep link). The identity
   * is single-use and self-contained (includes the ephemeral key pair). Returns
   * the identity together with the resolved signer address.
   */
  static fetchIdentity = async (
    identityId: string,
  ): Promise<{ identity: AuthIdentity; signer: string }> => {
    const response = await fetch(
      `${AuthServerProvider.authServerUrl}/identities/${encodeURIComponent(identityId)}`,
    );

    if (response.status === 404) {
      throw new SignInError('not_found', 'Sign in identity not found');
    }
    if (response.status === 410) {
      throw new SignInError('expired', 'Sign in identity expired');
    }
    if (response.status === 403) {
      throw new SignInError(
        'network',
        'Sign in identity could not be retrieved (network mismatch)',
      );
    }
    if (!response.ok) {
      throw new SignInError('unknown', `Failed to fetch identity (${response.status})`);
    }

    const { identity } = await response.json();
    const payload = identity?.authChain?.[0]?.payload;
    if (typeof payload !== 'string') {
      throw new SignInError('unknown', 'Malformed identity response');
    }

    return { identity, signer: payload.toLowerCase() };
  };

  /**
   * Completes a deep-link sign in: fetches the identity for the given id and
   * persists it. Returns the signer address.
   */
  static applyDeepLinkIdentity = async (identityId: string): Promise<string> => {
    const { identity, signer } = await AuthServerProvider.fetchIdentity(identityId);
    localStorage.setItem(STORAGE_KEY_ADDRESS, signer);
    sso.localStorageStoreIdentity(signer, identity);
    return signer;
  };

  /**
   * Get the persisted account from local storage.
   */
  static getAccount = () => {
    return localStorage.getItem(STORAGE_KEY_ADDRESS);
  };

  /**
   * Clears the identity and the rest of the persisted data created by this provider.
   */
  static deactivate = () => {
    const account = AuthServerProvider.getAccount();

    if (account) {
      sso.localStorageClearIdentity(account);
    }

    localStorage.removeItem(STORAGE_KEY_ADDRESS);
    localStorage.removeItem(STORAGE_KEY_CHAIN_ID);
  };

  /**
   * Check that the current account has a an identity that is not expired.
   */
  static hasValidIdentity = () => {
    const account = AuthServerProvider.getAccount();

    if (!account) {
      return false;
    }

    // The sso function will not return an identity if it is expired.
    return !!sso.localStorageGetIdentity(account);
  };

  /**
   * Waits for an outcome message but times out if the expiration defined in the provided request is reached.
   */
  private static awaitOutcomeWithTimeout = async (socket: Socket, requestResponse: any) => {
    const delayMs = new Date(requestResponse.expiration).getTime() - Date.now();
    const safeDelayMs = Number.isFinite(delayMs) && delayMs > 0 ? delayMs : 0;

    const onMessage = (msg: any) => {
      if (msg.requestId === requestResponse.requestId) {
        socket.off('outcome', onMessage);
        resolve(msg);
      }
    };

    let resolve: (value: any) => void;
    const resultPromise = new Promise<any>(r => {
      resolve = r;
    });

    socket.on('outcome', onMessage);

    const timeoutPromise = new Promise<any>((_, reject) => {
      setTimeout(() => {
        socket.off('outcome', onMessage);
        reject(new Error('Timeout'));
      }, safeDelayMs);
    });

    try {
      return await Promise.race([timeoutPromise, resultPromise]);
    } finally {
      socket.disconnect();
    }
  };

  /**
   * Builds the auth dapp URL for the given request id. If `deeplink` is true,
   * the dapp will trigger a deep link back to the app once sign in completes.
   */
  static getAuthDappUrl = (requestId: string, deeplink?: boolean) => {
    return `${AuthServerProvider.authDappUrl}/requests/${requestId}${deeplink ? '?targetConfigId=creator-hub&flow=deeplink' : ''}`;
  };

  /**
   * Opens the browser on the auth dapp requests page for the given request id.
   * If `deeplink` is true, the dapp will trigger a deep link back to the app once the sign in flow is completed.
   */
  static openAuthDapp = (requestId: string, deeplink?: boolean) => {
    const url = AuthServerProvider.getAuthDappUrl(requestId, deeplink);
    const target = '_blank';
    const features = 'noopener,noreferrer';
    AuthServerProvider.openBrowser
      ? AuthServerProvider.openBrowser(url, target, features)
      : window.open(url, target, features);
    if (deeplink) {
      // Only the deep-link sign-in flow passes `deeplink`; the wallet-signature
      // flow in `request()` opens the dapp without it, so gating here keeps the
      // sign-in funnel from counting transaction-signing opens.
      void analytics.track('Sign In Dapp Opened', { method: 'deeplink' });
    }
  };

  /**
   * Creates a socket connection and waits for it to be connected before returning it.
   */
  private static getSocket = async () => {
    const socket = io(AuthServerProvider.authServerUrl);

    await new Promise<void>(resolve => {
      const onConnect = () => {
        socket.off('connect', onConnect);
        resolve();
      };

      socket.on('connect', onConnect);
    });

    return socket;
  };

  /**
   * Emits an event to create a request with a given payload and waits for the response.
   */
  private static createRequest = async (
    socket: Socket,
    payload: Payload & { authChain?: AuthChain },
  ) => {
    // TODO: Also send the chain id for requests that are not dcl_personal_sign once supported on the auth server.
    const response = await socket.emitWithAck('request', {
      method: payload.method,
      params: payload.params,
      authChain: payload.authChain,
    });

    if (response.error) {
      socket.disconnect();
      throw new Error(response.error);
    }

    return response;
  };

  getChainId = () => {
    const chainId = localStorage.getItem(STORAGE_KEY_CHAIN_ID);

    if (!chainId) {
      return ChainId.ETHEREUM_MAINNET;
    }

    const numericChainId = Number(chainId);
    if (!Number.isFinite(numericChainId)) {
      return ChainId.ETHEREUM_MAINNET;
    }

    return numericChainId as ChainId;
  };

  getAccount = () => {
    return AuthServerProvider.getAccount();
  };

  request = async ({ method, params }: Payload): Promise<any> => {
    // The chain id is a virtual concept in this provider.
    // Changing it will only affect the rpc used for eth_calls and other non-transactional calls.
    // It will also affect the result value of the eth_chainId and net_version calls.
    if (method === 'wallet_switchEthereumChain') {
      const chainIdParam = params?.[0]?.chainId;
      if (typeof chainIdParam !== 'string') {
        return undefined;
      }
      const chainId = parseInt(chainIdParam, 16).toString();
      if (chainId === 'NaN') {
        return undefined;
      }
      localStorage.setItem(STORAGE_KEY_CHAIN_ID, chainId);
      return undefined;
    }

    if (method === 'eth_chainId') {
      return '0x' + this.getChainId().toString(16);
    }

    if (method === 'net_version') {
      return String(this.getChainId());
    }

    if (['eth_accounts', 'eth_requestAccounts'].includes(method)) {
      const account = this.getAccount();

      if (!account) {
        return [];
      } else {
        return [account];
      }
    }

    /**
     * These ethereum calls don't require the user's wallet given that no new transaction or signature is being created.
     * Because of this, we can use a regular provider to make the call, without the need of opening the auth dapp.
     */
    if (
      [
        'eth_getTransactionReceipt',
        'eth_estimateGas',
        'eth_call',
        'eth_getBalance',
        'eth_getStorageAt',
        'eth_blockNumber',
        'eth_gasPrice',
        'eth_protocolVersion',
        'net_version',
        'web3_sha3',
        'web3_clientVersion',
        'eth_getTransactionCount',
        'eth_getBlockByNumber',
        'eth_getCode',
      ].includes(method)
    ) {
      const rpcUrls = getRpcUrls(ProviderType.AUTH_SERVER);
      const rpcUrl = rpcUrls[this.getChainId() as keyof typeof rpcUrls];
      const client = createPublicClient({
        transport: http(rpcUrl),
      });

      return client.request({ method: method as any, params: params as any });
    }

    const socket = await AuthServerProvider.getSocket();

    const identity = this.getIdentity();

    const requestResponse = await AuthServerProvider.createRequest(socket, {
      method,
      params,
      authChain: identity?.authChain,
    });

    AuthServerProvider.openAuthDapp(requestResponse.requestId);

    const outcome = await AuthServerProvider.awaitOutcomeWithTimeout(socket, requestResponse);

    if (outcome.error) {
      throw outcome.error;
    }

    return outcome.result;
  };

  sendAsync = async (
    payload: Payload,
    callback: (
      err: OutcomeError | null,
      value: any | { error: OutcomeError; id: undefined; jsonrpc: '2.0' },
    ) => void,
  ): Promise<void> => {
    try {
      const result = await this.request(payload);
      callback(null, result);
    } catch (e) {
      if (isRPCError(e)) {
        callback(e, { error: e, id: undefined, jsonrpc: '2.0' });
      } else {
        callback(
          {
            code: 999,
            message: isErrorWithMessage(e) ? e.message : 'Unknown error',
          },
          {
            error: {
              code: 0,
              message: isErrorWithMessage(e) ? e.message : 'Unknown error',
            },
            id: undefined,
            jsonrpc: '2.0',
          },
        );
      }
    }
  };

  deactivate = () => {
    AuthServerProvider.deactivate();
  };

  private getIdentity = () => {
    const account = AuthServerProvider.getAccount();

    if (!account) {
      return null;
    }

    return sso.localStorageGetIdentity(account);
  };
}
