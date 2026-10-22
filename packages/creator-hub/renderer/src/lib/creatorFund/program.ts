/**
 * The beta's fixed numbers (`creator-fund/knowledge/definitions.md` → "Cycles and pool").
 * Payouts are made in USDC, so the pool and the minimum are stated in it too.
 */
export const PROGRAM = {
  poolUsdc: 10_000,
  minPlayers: 10,
  minPayoutUsdc: 5,
  /** Payouts per creator and per scene: the top 20 are public, rank and amount only. */
  leaderboardSize: 20,
} as const;
