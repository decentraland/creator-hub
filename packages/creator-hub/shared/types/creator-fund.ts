export type CycleStatus = 'upcoming' | 'running' | 'closed';

/** A reward cycle. `end_at` is exclusive; `pool_usdc` is `null` until the pool is set. */
export type Cycle = {
  id: number;
  start_at: string;
  end_at: string;
  pool_usdc: number | null;
  status: CycleStatus;
};

/** `GET /v3/creator-fund/cycles`. */
export type CreatorFundCycles = { cycles: Cycle[] };

/** `GET /v3/creator-fund/terms`: the current version (404 before any is published); `content` is Markdown. */
export type CreatorFundTerms = {
  version: number;
  title: string;
  published_at: string;
  content: string;
};

export type NewsItem = { id: number; title: string; body: string; published_at: string };

/** `GET /v3/creator-fund/news`, newest first. */
export type CreatorFundNews = { news: NewsItem[] };

export type WalletReason = 'internal' | 'suspended' | 'excluded';

/** `GET /v3/creator-fund/eligibility`. Reasons may carry codes newer than this app. */
export type Eligibility = { eligible: boolean; reasons: (WalletReason | string)[] };

export type EnrollmentStatus = 'active' | 'suspended';

/** `GET /v3/creator-fund/enrollment` (404 when not enrolled) and the `PUT` response. */
export type Enrollment = {
  status: EnrollmentStatus;
  enrolled_at: string;
  terms_version: number | null;
  first_name: string;
  last_name: string;
  email: string;
  email_verified_at: string | null;
};

/** `PUT /v3/creator-fund/enrollment` body: 201 on the first join, 200 on a re-accept. */
export type EnrollmentRequest = {
  first_name: string;
  last_name: string;
  email: string;
  /** An integer: the current `GET /v3/creator-fund/terms` version. */
  terms_version: number;
};

export type PlaceReason =
  | 'content_policy'
  | 'excluded'
  | 'not_owner'
  | 'creator_not_eligible'
  | 'terms_outdated';

export type PlaceStatus = 'in_program' | 'eligible' | 'not_eligible' | 'replaced';

/** A place under the Places API's names. A collaborator is always `not_eligible` + `not_owner`. */
export type CreatorFundPlace = {
  id: string;
  title: string | null;
  image: string | null;
  world: boolean;
  world_name: string | null;
  /** `"x,y"`. */
  base_position: string;
  positions: string[];
  owner: string | null;
  role: 'owner' | 'collaborator';
  status: PlaceStatus;
  reasons: (PlaceReason | string)[];
};

/** `GET /v3/creator-fund/places?cycle=`: the user's places for that cycle; `cycle` is `null` only when no cycle exists. */
export type MyPlaces = { cycle: Cycle | null; places: CreatorFundPlace[] };

export type LeaderboardCycle = number | 'all';

export type LeaderboardEntry = {
  rank: number;
  place: CreatorFundPlace;
  /** USDC as a decimal string, e.g. `"1842.50"`. */
  earned_usdc: string;
};

/** `GET /v3/creator-fund/leaderboard?cycle=` (mock only in v0): the top 20; ties share a rank. */
export type Leaderboard = { cycle_id: LeaderboardCycle; entries: LeaderboardEntry[] };

/** `GET /v3/creator-fund/banner` (hidden in v0), or `null` for its 204. */
export type CreatorFundBanner = { markdown: string } | null;

/** Non-2xx body; a 403 carries `reasons` and no `message`; a 429 `too_soon` carries `resend_available_at`. */
export type CreatorFundErrorBody = {
  error: string;
  message?: string;
  reasons?: string[];
  resend_available_at?: string;
};

export type PayoutStatus = 'pending' | 'paid';

/** A place as a payout lists it. */
export type PayoutPlaceRef = Pick<
  CreatorFundPlace,
  'id' | 'title' | 'image' | 'world' | 'world_name' | 'base_position'
>;

/** One paid place of a payout; `amount_usdc` is a decimal string. */
export type PayoutPlace = { place: PayoutPlaceRef; amount_usdc: string };

/** A cycle's payout (mock only): `amount_usdc` sums `places`; `transaction_hash` is set once `paid`. */
export type Payout = {
  cycle: Pick<Cycle, 'id' | 'start_at' | 'end_at' | 'status'>;
  status: PayoutStatus;
  paid_places: number;
  amount_usdc: string;
  transaction_hash: string | null;
  paid_at: string | null;
  places: PayoutPlace[];
};

/** `GET /v3/creator-fund/payouts` (mock only), newest cycle first; empty before the first payout. */
export type CreatorFundPayouts = { payouts: Payout[] };

/** `GET /v3/creator-fund/payout-wallet` (404 when none is set) and the `PUT` response. */
export type PayoutWallet = { address: string; updated_at: string };

/** `PUT /v3/creator-fund/payout-wallet` body: 201 on the first set, 200 on a change. */
export type PayoutWalletRequest = { address: string };

/** `POST /v3/creator-fund/enrollment/email-verification` (mock only): a code was sent. */
export type EmailVerification = {
  sent_at: string;
  expires_at: string;
  resend_available_at: string;
};

/** `PUT /v3/creator-fund/enrollment/email-verification` body; answers with the enrollment. */
export type EmailVerificationRequest = { code: string };
