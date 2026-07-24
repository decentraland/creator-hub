import type {
  CreatorScenesStats,
  SceneDailyStats,
  SceneMetricsWindow,
  SceneRetentionPoint,
  SceneStats,
} from '../../../shared/types/metrics';

export const FIXTURE_AS_OF = '2026-07-21';
export const FIXTURE_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function makeDaily(
  days: number,
  row: Omit<SceneDailyStats, 'date'>,
  overrides: Record<string, Partial<SceneDailyStats>> = {},
): SceneDailyStats[] {
  const rows: SceneDailyStats[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(FIXTURE_AS_OF, -i);
    rows.push({ date, ...row, ...overrides[date] });
  }
  return rows;
}

function makeWindow(overrides: Partial<SceneMetricsWindow> = {}): SceneMetricsWindow {
  return {
    users: 0,
    newUsers: 0,
    returningUsers: 0,
    visits: 0,
    medianActiveTimeS: 0,
    totalActiveHours: 0,
    afkTimePct: 0,
    peakConcurrentUsers: 0,
    medianFps: null,
    perfSessions: 0,
    dau: 0,
    desktopUsers: 0,
    mobileUsers: 0,
    messagesSent: 0,
    emotesPlayed: 0,
    avgSessionActiveTimeS: 0,
    ...overrides,
  };
}

function makeRetentionSeries(
  days: number,
  base: { cohort: number; d1: number; d7: number; d30: number },
  masked = false,
): SceneRetentionPoint[] {
  const rows: SceneRetentionPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(FIXTURE_AS_OF, -i);
    const wobble = ((i % 5) - 2) * 1.5;
    rows.push(
      masked
        ? { date, cohort: base.cohort, d1: null, d7: null, d30: null }
        : {
            date,
            cohort: base.cohort,
            d1: Math.round((base.d1 + wobble) * 10) / 10,
            d7: Math.round((base.d7 + wobble) * 10) / 10,
            d30: Math.round((base.d30 + wobble) * 10) / 10,
          },
    );
  }
  return rows;
}

export const healthyGenesisScene: SceneStats = {
  sceneType: 'genesis',
  sceneId: '-3|-2',
  title: 'Plaza Corner',
  deployerAddress: FIXTURE_ADDRESS,
  windows: {
    yesterday: makeWindow({
      users: 30,
      newUsers: 5,
      returningUsers: 25,
      visits: 50,
      medianActiveTimeS: 150,
      totalActiveHours: 2.5,
      afkTimePct: 8.4,
      peakConcurrentUsers: 27,
      medianFps: 42.1,
      perfSessions: 20,
      dau: 30,
      desktopUsers: 28,
      mobileUsers: 4,
      messagesSent: 120,
      emotesPlayed: 60,
      avgSessionActiveTimeS: 190,
    }),
    last_7d: makeWindow({
      users: 120,
      newUsers: 35,
      returningUsers: 85,
      visits: 350,
      medianActiveTimeS: 152,
      totalActiveHours: 15.3,
      afkTimePct: 9.1,
      peakConcurrentUsers: 27,
      medianFps: 42.1,
      perfSessions: 60,
      dau: 12,
      desktopUsers: 108,
      mobileUsers: 18,
      messagesSent: 820,
      emotesPlayed: 430,
      avgSessionActiveTimeS: 205,
    }),
    last_30d: makeWindow({
      users: 400,
      newUsers: 150,
      returningUsers: 250,
      visits: 1500,
      medianActiveTimeS: 149,
      totalActiveHours: 63.0,
      afkTimePct: 8.9,
      peakConcurrentUsers: 27,
      medianFps: 42.3,
      perfSessions: 240,
      dau: 13,
      desktopUsers: 360,
      mobileUsers: 48,
      messagesSent: 3400,
      emotesPlayed: 1800,
      avgSessionActiveTimeS: 201,
    }),
  },
  retention: { cohort: 1692, d1: 22.6, d7: 36.2, d30: 41.0 },
  retentionSeries: makeRetentionSeries(90, { cohort: 40, d1: 22.6, d7: 36.2, d30: 41.0 }),
  daily: makeDaily(
    90,
    {
      visits: 50,
      uniqueUsers: 30,
      newUsers: 5,
      medianActiveTimeS: 150,
      peakConcurrentUsers: 12,
      messagesSent: 110,
      emotesPlayed: 55,
    },
    { [FIXTURE_AS_OF]: { peakConcurrentUsers: 27 } },
  ),
  deployDates: ['2026-06-20', '2026-07-10'],
};

export const zeroTrafficScene: SceneStats = {
  sceneType: 'genesis',
  sceneId: '10|20',
  title: 'Quiet Parcel',
  deployerAddress: FIXTURE_ADDRESS,
  windows: {
    yesterday: makeWindow(),
    last_7d: makeWindow(),
    last_30d: makeWindow(),
  },
  retention: { cohort: 0, d1: null, d7: null, d30: null },
  retentionSeries: [],
  daily: [],
  deployDates: ['2026-07-18'],
};

export const maskedRetentionScene: SceneStats = {
  sceneType: 'world',
  sceneId: 'hidden-gem.dcl.eth',
  title: 'Hidden Gem',
  deployerAddress: FIXTURE_ADDRESS,
  windows: {
    yesterday: makeWindow({
      users: 2,
      newUsers: 1,
      returningUsers: 1,
      visits: 2,
      medianActiveTimeS: 60,
      totalActiveHours: 0.1,
      afkTimePct: 3.2,
      peakConcurrentUsers: 2,
      perfSessions: 1,
      dau: 2,
      desktopUsers: 2,
      mobileUsers: 0,
      messagesSent: 3,
      emotesPlayed: 1,
      avgSessionActiveTimeS: 70,
    }),
    last_7d: makeWindow({
      users: 8,
      newUsers: 4,
      returningUsers: 4,
      visits: 14,
      medianActiveTimeS: 65,
      totalActiveHours: 0.3,
      afkTimePct: 4.0,
      peakConcurrentUsers: 2,
      perfSessions: 3,
      dau: 2,
      desktopUsers: 7,
      mobileUsers: 1,
      messagesSent: 12,
      emotesPlayed: 5,
      avgSessionActiveTimeS: 72,
    }),
    last_30d: makeWindow({
      users: 20,
      newUsers: 12,
      returningUsers: 8,
      visits: 40,
      medianActiveTimeS: 62,
      totalActiveHours: 0.8,
      afkTimePct: 4.5,
      peakConcurrentUsers: 2,
      perfSessions: 8,
      dau: 2,
      desktopUsers: 18,
      mobileUsers: 3,
      messagesSent: 30,
      emotesPlayed: 14,
      avgSessionActiveTimeS: 74,
    }),
  },
  retention: { cohort: 6, d1: null, d7: null, d30: null },
  retentionSeries: makeRetentionSeries(14, { cohort: 6, d1: 0, d7: 0, d30: 0 }, true),
  daily: makeDaily(14, {
    visits: 2,
    uniqueUsers: 2,
    newUsers: 1,
    medianActiveTimeS: 60,
    peakConcurrentUsers: 2,
    messagesSent: 2,
    emotesPlayed: 1,
  }),
  deployDates: [],
};

export const healthyWorldScene: SceneStats = {
  sceneType: 'world',
  sceneId: 'kickoff.dcl.eth',
  title: 'Kickoff',
  deployerAddress: FIXTURE_ADDRESS,
  windows: {
    yesterday: makeWindow({
      users: 25,
      newUsers: 4,
      returningUsers: 21,
      visits: 40,
      medianActiveTimeS: 180,
      totalActiveHours: 2.0,
      afkTimePct: 7.2,
      peakConcurrentUsers: 8,
      medianFps: 55.0,
      perfSessions: 10,
      dau: 25,
      desktopUsers: 22,
      mobileUsers: 5,
      messagesSent: 90,
      emotesPlayed: 48,
      avgSessionActiveTimeS: 240,
    }),
    last_7d: makeWindow({
      users: 175,
      newUsers: 28,
      returningUsers: 147,
      visits: 280,
      medianActiveTimeS: 178,
      totalActiveHours: 13.8,
      afkTimePct: 7.5,
      peakConcurrentUsers: 8,
      medianFps: 55.0,
      perfSessions: 40,
      dau: 25,
      desktopUsers: 158,
      mobileUsers: 24,
      messagesSent: 640,
      emotesPlayed: 330,
      avgSessionActiveTimeS: 245,
    }),
    last_30d: makeWindow({
      users: 600,
      newUsers: 120,
      returningUsers: 480,
      visits: 1200,
      medianActiveTimeS: 181,
      totalActiveHours: 60.0,
      afkTimePct: 7.4,
      peakConcurrentUsers: 8,
      medianFps: 54.0,
      perfSessions: 160,
      dau: 26,
      desktopUsers: 540,
      mobileUsers: 72,
      messagesSent: 2600,
      emotesPlayed: 1400,
      avgSessionActiveTimeS: 243,
    }),
  },
  retention: { cohort: 429, d1: 18.0, d7: 30.5, d30: 35.2 },
  retentionSeries: makeRetentionSeries(90, { cohort: 30, d1: 18.0, d7: 30.5, d30: 35.2 }),
  daily: makeDaily(90, {
    visits: 40,
    uniqueUsers: 25,
    newUsers: 4,
    medianActiveTimeS: 180,
    peakConcurrentUsers: 8,
    messagesSent: 80,
    emotesPlayed: 42,
  }),
  deployDates: ['2026-07-15'],
};

export const creatorScenesStatsFixture: CreatorScenesStats = {
  address: FIXTURE_ADDRESS,
  asOf: FIXTURE_AS_OF,
  scenes: [healthyGenesisScene, zeroTrafficScene, maskedRetentionScene, healthyWorldScene],
};

function emptyWindow(): SceneMetricsWindow {
  return {
    users: null,
    newUsers: null,
    returningUsers: null,
    visits: null,
    medianActiveTimeS: null,
    totalActiveHours: null,
    afkTimePct: null,
    peakConcurrentUsers: null,
    medianFps: null,
    perfSessions: null,
    dau: null,
    desktopUsers: null,
    mobileUsers: null,
    messagesSent: null,
    emotesPlayed: null,
    avgSessionActiveTimeS: null,
  };
}

export const honestEmptyScene: SceneStats = {
  sceneType: 'world',
  sceneId: 'sparse.dcl.eth',
  title: 'Sparse World',
  deployerAddress: null,
  windows: {
    yesterday: emptyWindow(),
    last_7d: emptyWindow(),
    last_30d: emptyWindow(),
  },
  retention: { cohort: null, d1: null, d7: null, d30: null },
  retentionSeries: [],
  daily: [
    {
      date: FIXTURE_AS_OF,
      visits: null,
      uniqueUsers: 3,
      newUsers: null,
      medianActiveTimeS: null,
      peakConcurrentUsers: null,
      messagesSent: null,
      emotesPlayed: null,
    },
  ],
  deployDates: [],
};
