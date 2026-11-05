const WALLET_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** Whether a value is a wallet address: `0x` and 40 hex characters, 42 in all. */
export const isWalletAddress = (value: string) => WALLET_ADDRESS.test(value);

/** An address as its first 7 and last 6 characters, `0x6BB7a...Dfb47f`. */
export const shortAddress = (address: string) => `${address.slice(0, 7)}...${address.slice(-6)}`;
