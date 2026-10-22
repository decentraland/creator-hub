/** USDC is not an ISO 4217 code, so Intl can't format it as a currency: append the ticker. */
const usdc = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const wholeUsdc = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** Cycle dates are UTC calendar days; formatting them in local time would shift them. */
const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const dayWithYear = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "389.40 USDC". */
export const formatUsdc = (value: number) => `${usdc.format(value)} USDC`;

/** "10,000 USDC", for program constants that are always whole amounts. */
export const formatWholeUsdc = (value: number) => `${wholeUsdc.format(value)} USDC`;

/** `2026-10-15` → "Oct 15, 2026". */
export const formatCycleDate = (isoDate: string) => dayWithYear.format(new Date(isoDate));

/** "Oct 1 – Oct 15, 2026". */
export const formatCycleRange = (start: string, end: string) =>
  `${day.format(new Date(start))} – ${dayWithYear.format(new Date(end))}`;

/** `0x1234…abcd`. */
export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

const POLYGONSCAN_TX_URL = 'https://polygonscan.com/tx/';

export const txUrl = (hash: string) => `${POLYGONSCAN_TX_URL}${hash}`;
