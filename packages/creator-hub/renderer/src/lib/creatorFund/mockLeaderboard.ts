import type { Cycle, Leaderboard, LeaderboardCreator, LeaderboardScene } from './contract';
import { hashHex, hashUnit } from './hash';
import { PROGRAM } from './program';

const LEADERBOARD_SIZE = PROGRAM.leaderboardSize;

/**
 * Mock leaderboards: who a closed cycle paid, and how much.
 *
 * Each cycle's pool is split along a long tail (rank r gets a share ∝ 1/r^1.1),
 * the shape % Share of Metric produced over the five beta cycles: about a
 * hundred creators paid, the top 10% taking most of the pool. The asking
 * creator's own standing comes from the same split, so their leaderboard row
 * and their Past payouts row always agree.
 */

/** How steeply the pool falls off with rank. */
const TAIL_EXPONENT = 1.1;

/** Creators the scene board is drawn from: enough for their scenes to fill a top 20. */
const SCENE_SOURCE_CREATORS = 30;

const CREATOR_NAMES = [
  'pixelforge',
  'lunarbyte',
  'neonharbor',
  'voxelvale',
  'quietcomet',
  'mossyrobot',
  'skyloom',
  'brightvault',
  'copperfox',
  'duneworks',
  'glasswing',
  'hollowpine',
  'irisgate',
  'jadeorbit',
  'kiteworks',
  'lumenpark',
  'maplecore',
  'nimbusbay',
  'opalforge',
  'pebbleverse',
  'quillstudio',
  'rivetlabs',
  'saltmarsh',
  'tidalgames',
  'umberhall',
  'velvetarcade',
  'wildgrove',
  'xenoplay',
  'yarrowworks',
  'zephyrfield',
  'amberloop',
  'bramblecraft',
];

const SCENE_TITLES = [
  'Neon Drift',
  'Mushroom Maze',
  'Sky Race',
  'Moonlit Gallery',
  'Pixel Arena',
  'Hidden Grove',
  'Clockwork Tower',
  'Lava Run',
  'Frost Hollow',
  'Coral Depths',
  'Sunset Karts',
  'Ghost Manor',
  'Candy Rush',
  'Orbit Station',
  'Jungle Ruins',
  'Desert Rally',
  'Rooftop Parkour',
  'Echo Caves',
  'Garden Party',
  'Brick Battle',
  'Cloud Hop',
  'Deep Space Bar',
  'Mirror Lab',
  'Tiny Town',
  'Pirate Cove',
  'Skate Plaza',
  'Rune Quest',
  'Bubble Pop',
  'Night Market',
  'Volcano Golf',
];

const NOT_PAID_SHARE = 0.12;
const TOP_20_SHARE = 0.13;

const toCents = (value: number) => Math.round(value * 100) / 100;

const mockAddress = (seed: string) => `0x${hashHex(seed, 40)}`;

/** Every amount the cycle paid, highest first: the amount at index `r - 1` is rank r's. */
export function cycleDistribution(cycle: Cycle): number[] {
  const paidCreators = 80 + Math.floor(hashUnit(`${cycle.id}:creators`) * 30);
  const weights = Array.from({ length: paidCreators }, (_, i) => 1 / (i + 1) ** TAIL_EXPONENT);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map(weight => toCents((PROGRAM.poolUsdc * weight) / total));
}

export type Standing = { rank: number; amount: number; paidPlaces: number };

/**
 * Where a creator placed in a cycle, or `null` when the cycle didn't pay them.
 * Biased so a demo sees every case: unpaid, inside the top 20, and further down.
 */
export function creatorStanding(address: string, cycle: Cycle): Standing | null {
  const seed = `${address.toLowerCase()}:${cycle.id}`;
  const roll = hashUnit(`${seed}:standing`);
  if (roll < NOT_PAID_SHARE) return null;

  const amounts = cycleDistribution(cycle);
  const position = hashUnit(`${seed}:rank`);
  const rank =
    roll < NOT_PAID_SHARE + TOP_20_SHARE
      ? 5 + Math.floor(position * (LEADERBOARD_SIZE - 4))
      : LEADERBOARD_SIZE + 1 + Math.floor(position * (amounts.length - LEADERBOARD_SIZE));
  return {
    rank,
    amount: amounts[rank - 1],
    paidPlaces: 1 + Math.floor(hashUnit(`${seed}:places`) * 3),
  };
}

function creatorsOf(cycle: Cycle, amounts: number[], count: number): LeaderboardCreator[] {
  const names = [...CREATOR_NAMES].sort(
    (a, b) => hashUnit(`${cycle.id}:${a}`) - hashUnit(`${cycle.id}:${b}`),
  );
  return amounts.slice(0, count).map((amount, i) => ({
    rank: i + 1,
    address: mockAddress(`${cycle.id}:creator:${i}`),
    // Some creators have no NAME and show as their address.
    name: hashUnit(`${cycle.id}:named:${i}`) < 0.85 ? (names[i % names.length] ?? null) : null,
    paid_places: 1 + Math.floor(hashUnit(`${cycle.id}:places:${i}`) * 4),
    amount_usdc: amount,
  }));
}

/** Each creator's payout split over their paid scenes, the first scene taking the most. */
function scenesOf(cycle: Cycle, creators: LeaderboardCreator[]): LeaderboardScene[] {
  const titles = [...SCENE_TITLES].sort(
    (a, b) => hashUnit(`${cycle.id}:${a}`) - hashUnit(`${cycle.id}:${b}`),
  );
  let next = 0;
  const scenes = creators.flatMap(creator => {
    const weights = Array.from(
      { length: creator.paid_places },
      (_, i) => (1 + hashUnit(`${cycle.id}:${creator.address}:${i}`)) / (i + 1),
    );
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    return weights.map(weight => {
      const title = titles[next++ % titles.length];
      const inWorld = hashUnit(`${cycle.id}:world:${title}`) < 0.7;
      const position = `${Math.floor(hashUnit(`${title}:x`) * 300) - 150},${Math.floor(hashUnit(`${title}:y`) * 300) - 150}`;
      const worldName = inWorld ? `${title.toLowerCase().replace(/\s+/g, '')}.dcl.eth` : null;
      return {
        rank: 0,
        place_id: worldName ? `world:${worldName}` : `land:${position}`,
        title,
        world_name: worldName,
        base_position: inWorld ? '0,0' : position,
        owner: creator.address,
        owner_name: creator.name,
        amount_usdc: toCents((creator.amount_usdc * weight) / total),
      };
    });
  });
  return scenes
    .sort((a, b) => b.amount_usdc - a.amount_usdc)
    .slice(0, LEADERBOARD_SIZE)
    .map((scene, i) => ({ ...scene, rank: i + 1 }));
}

export function leaderboardFor(cycle: Cycle, address?: string): Leaderboard {
  const amounts = cycleDistribution(cycle);
  const standing = address ? creatorStanding(address, cycle) : null;
  const me: LeaderboardCreator | null =
    address && standing
      ? {
          rank: standing.rank,
          address,
          name: null,
          paid_places: standing.paidPlaces,
          amount_usdc: standing.amount,
        }
      : null;

  const creators = creatorsOf(cycle, amounts, SCENE_SOURCE_CREATORS);
  // The asking creator takes their slot; the board shows them where they placed.
  if (me && me.rank <= SCENE_SOURCE_CREATORS) creators[me.rank - 1] = me;

  return {
    cycle_id: cycle.id,
    paid_creators: amounts.length,
    paid_places: Math.round(amounts.length * 1.8),
    creators: creators.slice(0, LEADERBOARD_SIZE),
    // The scene board is drawn from everyone else: the POC has no titles for the asker's scenes.
    scenes: scenesOf(
      cycle,
      creators.filter(creator => creator !== me),
    ),
    me,
  };
}
