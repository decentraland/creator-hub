/**
 * Wire types for the Creator Fund backoffice.
 *
 * The first block mirrors `creator-fund-eligibility/src/types/eligibility.ts`
 * (rodrigo685/creator-fund) so the mock answers exactly what that service will.
 * The second block is proposed by this POC and has no service behind it yet —
 * see `docs/creator-fund-poc.md` → "Data contract".
 */

// --- creator-fund-eligibility (draft service) ----------------------------------------------

/** Why a place can't opt in. Player counts never block opting in. */
export enum OptInReason {
  PLACE_DISABLED = 'place_disabled',
  EXCLUDED_CONTENT = 'excluded_content',
  PRIVATE_WORLD = 'private_world',
  WORLD_ACCESS_UNAVAILABLE = 'world_access_unavailable',
  ROAD = 'road',
}

/** Why a place wasn't paid in a cycle. */
export enum PayoutReason {
  EXCLUDED_CONTENT = 'excluded_content',
  PRIVATE_WORLD = 'private_world',
  ROAD = 'road',
  BELOW_MIN_PLAYERS = 'below_min_players',
}

export type CycleSummary = {
  id: string;
  start_date: string;
  end_date: string;
  qualified: boolean;
  reasons: PayoutReason[];
};

export type PlaceEligibility = {
  /** The service's Places API id. The POC puts its location key here — see `fundPlaceKey`. */
  place_id: string;
  title: string | null;
  world_name: string | null;
  base_position: string;
  owner: string | null;
  opt_in: { eligible: boolean; reasons: OptInReason[] };
  cycle: CycleSummary;
};

export type Cycle = {
  id: string;
  start_date: string;
  end_date: string;
  min_players: number;
  published_at: string;
  places: number;
  qualified_places: number;
};

// --- proposed --------------------------------------------------------------------------------

export enum CreatorIneligibleReason {
  /** Foundation or Regenesis Labs account, or the Foundation wallet. */
  INTERNAL_ACCOUNT = 'internal_account',
  /** Suspended for abuse, e.g. bot farming in an earlier cycle. */
  SUSPENDED = 'suspended',
}

export type CreatorEligibility = {
  address: string;
  eligible: boolean;
  reasons: CreatorIneligibleReason[];
};

export type Enrollment = {
  address: string;
  enrolled_at: string;
  terms_version: string;
};

export type PayoutWallet = {
  address: string;
  locked: boolean;
  updated_at: string;
};

export enum PayoutStatus {
  PAID = 'paid',
  PROCESSING = 'processing',
  /** Earned something, but under the $5 minimum. */
  BELOW_MINIMUM = 'below_minimum',
  /** No place reached the payout's player minimum. */
  NOT_QUALIFIED = 'not_qualified',
}

export type Payout = {
  cycle_id: string;
  start_date: string;
  end_date: string;
  status: PayoutStatus;
  amount_usd: number;
  qualified_places: number;
  wallet: string | null;
  tx_hash: string | null;
  paid_at: string | null;
};
