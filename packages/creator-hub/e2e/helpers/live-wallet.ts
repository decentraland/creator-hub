import type { Page } from 'playwright';
import { privateKeyToAccount } from 'viem/accounts';

const SEPOLIA_CHAIN_ID_HEX = '0xaa36a7';

function readPrivateKey(): `0x${string}` {
  const privateKey = process.env.E2E_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      'e2e: E2E_PRIVATE_KEY is not set — put it in packages/creator-hub/.env.e2e (gitignored)',
    );
  }
  return privateKey as `0x${string}`;
}

/** Address of the wallet the `@live` tier signs with. */
export function liveWalletAddress(): string {
  return privateKeyToAccount(readPrivateKey()).address;
}

/**
 * Installs an EIP-1193 provider, announced over EIP-6963 as MetaMask, that signs with
 * `E2E_PRIVATE_KEY`. Signing runs in the test process through `exposeFunction`, so the key
 * never reaches the page.
 *
 * @returns the address the provider reports.
 */
export async function installLiveWallet(page: Page): Promise<string> {
  const account = privateKeyToAccount(readPrivateKey());

  await page.exposeFunction('__e2eWalletSign', async (method: string, params: string[]) => {
    if (method === 'personal_sign') {
      return account.signMessage({ message: { raw: params[0] as `0x${string}` } });
    }
    if (method === 'eth_signTypedData_v4') {
      return account.signTypedData(JSON.parse(params[1]));
    }
    throw new Error(`e2e: the auth dapp asked the wallet for an unsupported method: ${method}`);
  });

  await page.addInitScript(
    ({ address, chainId }: { address: string; chainId: string }) => {
      const sign = (window as unknown as Record<string, (...args: unknown[]) => Promise<string>>)
        .__e2eWalletSign;
      const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

      const provider = {
        isMetaMask: true,
        chainId,
        selectedAddress: address,
        async request({ method, params = [] }: { method: string; params?: unknown[] }) {
          switch (method) {
            case 'eth_requestAccounts':
            case 'eth_accounts':
              return [address];
            case 'eth_chainId':
              return chainId;
            case 'net_version':
              return String(Number.parseInt(chainId, 16));
            case 'wallet_switchEthereumChain':
            case 'wallet_addEthereumChain':
            case 'wallet_revokePermissions':
              return null;
            case 'wallet_requestPermissions':
              return [{ parentCapability: 'eth_accounts' }];
            case 'personal_sign':
            case 'eth_signTypedData_v4':
              return sign(method, params);
            default:
              throw Object.assign(new Error(`unsupported method ${method}`), { code: 4200 });
          }
        },
        on(event: string, handler: (...args: unknown[]) => void) {
          (listeners[event] ??= []).push(handler);
        },
        removeListener(event: string, handler: (...args: unknown[]) => void) {
          listeners[event] = (listeners[event] ?? []).filter(entry => entry !== handler);
        },
        enable() {
          return provider.request({ method: 'eth_requestAccounts' });
        },
      };

      (window as unknown as { ethereum: unknown }).ethereum = provider;

      const detail = Object.freeze({
        info: {
          uuid: '8f0f1e2d-3c4b-4a59-8687-0d1c2b3a4f5e',
          name: 'MetaMask',
          rdns: 'io.metamask',
          icon: 'data:image/svg+xml;base64,PHN2Zy8+',
        },
        provider,
      });
      const announce = () =>
        window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail }));
      window.addEventListener('eip6963:requestProvider', announce);
      announce();
    },
    { address: account.address, chainId: SEPOLIA_CHAIN_ID_HEX },
  );

  return account.address;
}
