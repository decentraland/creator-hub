/** `0x1234…7890`, for names in labels and confirms. */
export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
