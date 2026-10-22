import type {
  CreatorEligibility,
  Cycle,
  Enrollment,
  Leaderboard,
  Payout,
  PayoutWallet,
  PlaceEligibility,
} from './contract';
import { CreatorIneligibleReason, OptInReason, PayoutReason, PayoutStatus } from './contract';
import { CLOSED_CYCLES, CURRENT_CYCLE } from './cycles';
import { hashHex, hashUnit } from './hash';
import { creatorStanding, leaderboardFor } from './mockLeaderboard';
import type { FundPlaceKey } from './places';
import { parseFundPlaceKey } from './places';
import { setBannerDismissed } from './preferences';
import { PROGRAM } from './program';

/**
 * Stand-in for the Creator Fund backoffice, so every surface can be exercised
 * before any service exists. Answers the shapes in `contract.ts`.
 *
 * State lives in localStorage, one record per wallet. Place answers are a pure
 * function of the place key, so a tile shows the same label on every visit.
 *
 * Swap for a real client by implementing `CreatorFundApi` over fetch.
 */

export const MOCK_STORAGE_KEY = 'creator-hub:creator-fund-mock';

/** From `anti-bot-service/exclusions.json`: content the fund never pays. */
const EXCLUDED_WORLDS: Record<string, string> = {
  'cozyfarm.dcl.eth': 'CozyFarm',
  'regenesislabs.dcl.eth': 'Regenesis Labs',
  'towerofmadness.dcl.eth': 'Tower of Madness',
  'deadsurge.dcl.eth': 'Dead Surge',
  'pumpkinball.dcl.eth': 'Regenesis Labs',
  'toastedllama.dcl.eth': 'Regenesis Labs',
};

const FOUNDATION_WALLET = '0x5188e308fee25ac49c10f9fd9270d953c4822ce5';

export const TERMS_VERSION = '2026-10-beta';

export enum SimulatedCreator {
  ELIGIBLE = 'eligible',
  NOT_ELIGIBLE = 'not_eligible',
}

type WalletRecord = {
  enrollment: Enrollment | null;
  payoutWallet: PayoutWallet | null;
};

type MockState = {
  simulate: SimulatedCreator;
  wallets: Record<string, WalletRecord>;
};

const EMPTY_STATE: MockState = {
  simulate: SimulatedCreator.ELIGIBLE,
  wallets: {},
};

const EMPTY_RECORD: WalletRecord = { enrollment: null, payoutWallet: null };

function readState(): MockState {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);
    return raw ? { ...EMPTY_STATE, ...JSON.parse(raw) } : EMPTY_STATE;
  } catch {
    return EMPTY_STATE;
  }
}

function writeState(state: MockState) {
  try {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A blocked storage only costs the demo its memory across restarts.
  }
}

function updateRecord(address: string, update: (record: WalletRecord) => WalletRecord) {
  const state = readState();
  const key = address.toLowerCase();
  const record = update(state.wallets[key] ?? EMPTY_RECORD);
  writeState({ ...state, wallets: { ...state.wallets, [key]: record } });
  return record;
}

const recordOf = (address: string) => readState().wallets[address.toLowerCase()] ?? EMPTY_RECORD;

/** Long enough for the spinner to read as a real round trip. */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function placeEligibility(key: FundPlaceKey, title: string | null): PlaceEligibility {
  const { world, position } = parseFundPlaceKey(key);
  const excludedContent = world ? EXCLUDED_WORLDS[world] : undefined;
  const isPrivate = !!world && !excludedContent && hashUnit(`${key}:access`) < 0.16;

  const optInReasons = excludedContent
    ? [OptInReason.EXCLUDED_CONTENT]
    : isPrivate
      ? [OptInReason.PRIVATE_WORLD]
      : [];

  const payoutReasons: PayoutReason[] = excludedContent
    ? [PayoutReason.EXCLUDED_CONTENT]
    : isPrivate
      ? [PayoutReason.PRIVATE_WORLD]
      : hashUnit(`${key}:players`) < 0.25
        ? [PayoutReason.BELOW_MIN_PLAYERS]
        : [];

  const lastCycle = CLOSED_CYCLES[0];

  return {
    place_id: key,
    title,
    world_name: world,
    base_position: position,
    owner: null,
    opt_in: { eligible: optInReasons.length === 0, reasons: optInReasons },
    cycle: {
      id: lastCycle.id,
      start_date: lastCycle.start_date,
      end_date: lastCycle.end_date,
      qualified: payoutReasons.length === 0,
      reasons: payoutReasons,
    },
  };
}

/** One row per closed cycle, from the same standing the leaderboard shows. */
function payoutsFor(address: string, wallet: string | null): Payout[] {
  return CLOSED_CYCLES.map(cycle => {
    const standing = creatorStanding(address, cycle);
    const amount = standing?.amount ?? 0;
    const status =
      amount === 0
        ? PayoutStatus.NOT_QUALIFIED
        : amount < PROGRAM.minPayoutUsdc
          ? PayoutStatus.BELOW_MINIMUM
          : PayoutStatus.PAID;
    const paid = status === PayoutStatus.PAID;

    return {
      cycle_id: cycle.id,
      start_date: cycle.start_date,
      end_date: cycle.end_date,
      status,
      // Under the minimum a cycle pays 0; the status says why.
      amount_usdc: paid ? amount : 0,
      qualified_places: standing?.paidPlaces ?? 0,
      wallet: paid ? (wallet ?? address) : null,
      tx_hash: paid ? `0x${hashHex(`${address}:${cycle.id}`, 64)}` : null,
      paid_at: paid ? `${cycle.end_date}T00:00:00.000Z` : null,
    };
  });
}

export type CreatorFundApi = {
  getCreatorEligibility(address: string): Promise<CreatorEligibility>;
  getEnrollment(address: string): Promise<Enrollment | null>;
  enroll(address: string, termsVersion: string): Promise<Enrollment>;
  getPlacesEligibility(
    places: Array<{ key: FundPlaceKey; title: string | null }>,
  ): Promise<PlaceEligibility[]>;
  getPayoutWallet(address: string): Promise<PayoutWallet | null>;
  setPayoutWallet(address: string, wallet: string): Promise<PayoutWallet>;
  getPayouts(address: string): Promise<Payout[]>;
  getCurrentCycle(): Promise<Cycle>;
  /** Public. With `address`, the answer also carries that creator's own standing. */
  getLeaderboard(cycleId: string, address?: string): Promise<Leaderboard>;
};

export const mockBackoffice: CreatorFundApi = {
  async getCreatorEligibility(address) {
    await delay(1600);
    const internal = address.toLowerCase() === FOUNDATION_WALLET;
    const simulatedOut = readState().simulate === SimulatedCreator.NOT_ELIGIBLE;
    const reasons = internal
      ? [CreatorIneligibleReason.INTERNAL_ACCOUNT]
      : simulatedOut
        ? [CreatorIneligibleReason.SUSPENDED]
        : [];
    return { address, eligible: reasons.length === 0, reasons };
  },

  async getEnrollment(address) {
    await delay(200);
    return recordOf(address).enrollment;
  },

  async enroll(address, termsVersion) {
    await delay(1200);
    const enrollment: Enrollment = {
      address,
      enrolled_at: new Date().toISOString(),
      terms_version: termsVersion,
    };
    updateRecord(address, record => ({ ...record, enrollment }));
    return enrollment;
  },

  async getPlacesEligibility(places) {
    await delay(300);
    return places.map(({ key, title }) => placeEligibility(key, title));
  },

  async getPayoutWallet(address) {
    await delay(200);
    return recordOf(address).payoutWallet;
  },

  async setPayoutWallet(address, wallet) {
    await delay(700);
    const payoutWallet: PayoutWallet = {
      address: wallet,
      updated_at: new Date().toISOString(),
    };
    updateRecord(address, record => ({ ...record, payoutWallet }));
    return payoutWallet;
  },

  async getPayouts(address) {
    await delay(500);
    return payoutsFor(address, recordOf(address).payoutWallet?.address ?? null);
  },

  async getCurrentCycle() {
    return CURRENT_CYCLE;
  },

  async getLeaderboard(cycleId, address) {
    await delay(400);
    const cycle = CLOSED_CYCLES.find(closed => closed.id === cycleId);
    if (!cycle) throw new Error(`Cycle ${cycleId} isn't published`);
    return leaderboardFor(cycle, address);
  },
};

// --- demo controls: not part of the API, only the POC menu calls these ----------------------

export const mockControls = {
  getSimulatedCreator: () => readState().simulate,
  setSimulatedCreator: (simulate: SimulatedCreator) => writeState({ ...readState(), simulate }),
  /**
   * Leaves the fund, clears the wallet and brings the banner back. Keeps the
   * simulated creator: resetting is how a demo re-runs the join as that creator.
   */
  reset: () => {
    writeState({ ...EMPTY_STATE, simulate: readState().simulate });
    setBannerDismissed(false);
  },
};
