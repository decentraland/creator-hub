import { checksumAddress } from 'viem';

const WALLET_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/**
 * Whether a value is a wallet address: `0x` and 40 hex characters, 42 in all. A mixed-case
 * address carries an EIP-55 checksum and must match it, so a mistyped character in a pasted
 * address is caught here instead of sending payouts to a wallet nobody owns. All-lowercase and
 * all-uppercase addresses carry no checksum.
 */
export const isWalletAddress = (value: string) => {
  if (!WALLET_ADDRESS.test(value)) return false;
  const hex = value.slice(2);
  if (hex === hex.toLowerCase() || hex === hex.toUpperCase()) return true;
  return checksumAddress(value as `0x${string}`) === value;
};

/** An address as its first 7 and last 6 characters, `0x6BB7a...Dfb47f`. */
export const shortAddress = (address: string) => `${address.slice(0, 7)}...${address.slice(-6)}`;
