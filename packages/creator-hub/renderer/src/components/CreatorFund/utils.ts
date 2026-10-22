const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const wholeUsd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/** Cycle dates are UTC calendar days; formatting them in local time would shift them. */
const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const dayWithYear = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export const formatUsd = (value: number) => usd.format(value);

/** "$10,000", for program constants that are always whole dollars. */
export const formatWholeUsd = (value: number) => wholeUsd.format(value);

/** `2026-10-15` → "Oct 15, 2026". */
export const formatCycleDate = (isoDate: string) => dayWithYear.format(new Date(isoDate));

/** "Oct 1 – Oct 15, 2026". */
export const formatCycleRange = (start: string, end: string) =>
  `${day.format(new Date(start))} – ${dayWithYear.format(new Date(end))}`;

/** `0x1234…abcd`. */
export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

const POLYGONSCAN_TX_URL = 'https://polygonscan.com/tx/';

export const txUrl = (hash: string) => `${POLYGONSCAN_TX_URL}${hash}`;
