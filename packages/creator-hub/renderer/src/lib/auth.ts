import { createPublicClient, http, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { type Socket, io } from 'socket.io-client';
import { ChainId, ProviderType } from '@dcl/schemas';
import { Authenticator, type AuthIdentity, AuthLinkType, type AuthChain } from '@dcl/crypto';
import * as sso from '@dcl/single-sign-on-client';

export type EphemeralAuthAccount = {
  address: string;
  privateKey: Hex;
  publicKey: Hex;
};

const STORAGE_KEY_ADDRESS = 'auth-server-provider-address';
const STORAGE_KEY_CHAIN_ID = 'auth-server-provider-chain-id';

type Payload = {
  method: string;
  params: any[];
};

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
  private static openBrowser: (url: string, targer?: string, features?: string) => void;

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
   * Set the time it will take for the identity created on 'finishSignIn' to expire.
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
   * Initializes the first part of the sign in process.
   * It returns data such as the request expiration as well as the verification code which can be used on the frontend.
   * The returned data should be passed back to the `finishSignIn` method.
   */
  static initSignIn = async () => {
    const socket = await AuthServerProvider.getSocket();

    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const ephemeralAccount: EphemeralAuthAccount = {
      address: account.address,
      privateKey,
      publicKey: account.publicKey,
    };
    const expiration = new Date(Date.now() + AuthServerProvider.identityExpirationInMillis);
    const ephemeralMessage = Authenticator.getEphemeralMessage(
      ephemeralAccount.address,
      expiration,
    );

    const requestResponse = await AuthServerProvider.createRequest(socket, {
      method: 'dcl_personal_sign',
      params: [ephemeralMessage],
    });

    return {
      socket,
      ephemeralAccount,
      expiration,
      ephemeralMessage,
      requestResponse,
    };
  };

  /**
   * Should be called after the 'initSignIn' method with the same data it returned.
   * These methods are separate to allow the frontend to consume and display certain data before opening the auth dapp.
   */
  static finishSignIn = async ({
    socket,
    ephemeralAccount,
    expiration,
    ephemeralMessage,
    requestResponse,
  }: {
    socket: Socket;
    ephemeralAccount: EphemeralAuthAccount;
    expiration: Date;
    ephemeralMessage: string;
    requestResponse: any;
  }) => {
    AuthServerProvider.openAuthDapp(requestResponse);

    const { sender: signer, result: signature } = await AuthServerProvider.awaitOutcomeWithTimeout(
      socket,
      requestResponse,
    );

    const identity: AuthIdentity = {
      expiration,
      ephemeralIdentity: {
        address: ephemeralAccount.address,
        privateKey: ephemeralAccount.privateKey,
        publicKey: ephemeralAccount.publicKey,
      },
      authChain: [
        {
          type: AuthLinkType.SIGNER,
          payload: signer.toLowerCase(),
          signature: '',
        },
        {
          type: AuthLinkType.ECDSA_PERSONAL_EPHEMERAL,
          payload: ephemeralMessage,
          signature: signature,
        },
      ],
    };

    localStorage.setItem(STORAGE_KEY_ADDRESS, signer.toLowerCase());
    sso.localStorageStoreIdentity(signer, identity);
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
    const timeoutPromise = new Promise<any>((_, reject) => {
      setTimeout(
        () => {
          reject(new Error('Timeout'));
        },
        new Date(requestResponse.expiration).getTime() - Date.now(),
      );
    });

    const resultPromise = new Promise<any>(resolve => {
      const onMessage = (msg: any) => {
        if (msg.requestId === requestResponse.requestId) {
          socket.off('message', onMessage);
          resolve(msg);
        }
      };

      socket.on('outcome', onMessage);
    });

    try {
      return await Promise.race([timeoutPromise, resultPromise]);
    } finally {
      socket.disconnect();
    }
  };

  /**
   * Opens the browser on the auth dapp requests page for the given request id.
   */
  private static openAuthDapp = (requestResponse: any) => {
    const url = `${AuthServerProvider.authDappUrl}/requests/${requestResponse.requestId}`;
    const target = '_blank';
    const features = 'noopener,noreferrer';
    AuthServerProvider.openBrowser
      ? AuthServerProvider.openBrowser(url, target, features)
      : window.open(url, target, features);
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

    return Number(chainId) as ChainId;
  };

  getAccount = () => {
    return AuthServerProvider.getAccount();
  };

  request = async ({ method, params }: Payload): Promise<any> => {
    // The chain id is a virtual concept in this provider.
    // Changing it will only affect the rpc used for eth_calls and other non-transactional calls.
    // It will also affect the result value of the eth_chainId and net_version calls.
    if (method === 'wallet_switchEthereumChain') {
      const chainId = parseInt(params[0].chainId, 16).toString();

      localStorage.setItem(STORAGE_KEY_CHAIN_ID, chainId);

      return undefined;
    }

    if (['eth_chainId', 'net_version'].includes(method)) {
      return this.getChainId();
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

    AuthServerProvider.openAuthDapp(requestResponse);

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
      value: { error: OutcomeError; id: undefined; jsonrpc: '2.0' },
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
