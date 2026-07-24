import type { SceneDailyStats, SceneStats } from '/shared/types/metrics';
import type { CsvRow, DailyPoint, RangeDays, RetentionKey } from './types';

export function sceneDisplayName(
  scene: Pick<SceneStats, 'sceneType' | 'title' | 'sceneId'>,
): string {
  if (scene.sceneType === 'world') return scene.sceneId;
  return scene.title ?? scene.sceneId;
}

type WindowKey = 'last_7d' | 'last_30d';

export const WINDOW_BY_RANGE: Partial<Record<RangeDays, WindowKey>> = {
  7: 'last_7d',
  30: 'last_30d',
};

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function rangeDates(asOf: string, days: number): string[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dates.push(addDays(asOf, -i));
  }
  return dates;
}

function dailyInRange(scene: SceneStats, start: string, end: string): SceneDailyStats[] {
  return scene.daily.filter(row => row.date >= start && row.date <= end);
}

function weightedMedian(pairs: Array<[value: number, weight: number]>): number {
  const weighted = pairs.filter(([, weight]) => weight > 0).sort((a, b) => a[0] - b[0]);
  const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
  if (total === 0) return 0;
  let cumulative = 0;
  for (const [value, weight] of weighted) {
    cumulative += weight;
    if (cumulative >= total / 2) return value;
  }
  return weighted[weighted.length - 1][0];
}

export function buildCsvRows(scenes: SceneStats[], asOf: string, days: RangeDays): CsvRow[] {
  const byDate = new Map<string, SceneDailyStats[]>();
  for (const scene of scenes) {
    for (const row of scene.daily) {
      const rows = byDate.get(row.date);
      if (rows) rows.push(row);
      else byDate.set(row.date, [row]);
    }
  }
  return rangeDates(asOf, days).map(date => {
    const rows = byDate.get(date) ?? [];
    return {
      date,
      visits: rows.reduce((sum, row) => sum + (row.visits ?? 0), 0),
      uniqueUsers: rows.reduce((sum, row) => sum + (row.uniqueUsers ?? 0), 0),
      newUsers: rows.reduce((sum, row) => sum + (row.newUsers ?? 0), 0),
      medianActiveTimeS: weightedMedian(
        rows.map((row): [number, number] => [row.medianActiveTimeS ?? 0, row.visits ?? 0]),
      ),
      peakConcurrentUsers: rows.reduce(
        (max, row) => Math.max(max, row.peakConcurrentUsers ?? 0),
        0,
      ),
      messagesSent: rows.reduce((sum, row) => sum + (row.messagesSent ?? 0), 0),
      emotesPlayed: rows.reduce((sum, row) => sum + (row.emotesPlayed ?? 0), 0),
    };
  });
}

export function toCsv(rows: CsvRow[]): string {
  const header =
    'date,visits,unique_users,new_users,median_active_time_s,peak_concurrent_users,messages_sent,emotes_played';
  const lines = rows.map(row =>
    [
      row.date,
      row.visits,
      row.uniqueUsers,
      row.newUsers,
      row.medianActiveTimeS,
      row.peakConcurrentUsers,
      row.messagesSent,
      row.emotesPlayed,
    ].join(','),
  );
  return [header, ...lines].join('\n');
}

export function getLastDeploy(scene: SceneStats): string | null {
  return scene.deployDates.length ? scene.deployDates.reduce((a, b) => (a > b ? a : b)) : null;
}

export function retentionPoints(scene: SceneStats, key: RetentionKey): DailyPoint[] {
  return [...scene.retentionSeries]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(point => ({ date: point.date, value: point[key] }));
}

export function isSeriesEmpty(points: DailyPoint[]): boolean {
  return points.every(point => point.value === null);
}

export function tailPoints(points: DailyPoint[], days: RangeDays): DailyPoint[] {
  return days >= points.length ? points : points.slice(points.length - days);
}

export function buildSocialSeries(
  scenes: SceneStats[],
  asOf: string,
  days: RangeDays,
): { messages: DailyPoint[]; emotes: DailyPoint[] } {
  const byDate = new Map<string, SceneDailyStats[]>();
  for (const scene of scenes) {
    for (const row of scene.daily) {
      const rows = byDate.get(row.date);
      if (rows) rows.push(row);
      else byDate.set(row.date, [row]);
    }
  }
  const dates = rangeDates(asOf, days);
  return {
    messages: dates.map(date => ({
      date,
      value: (byDate.get(date) ?? []).reduce((sum, row) => sum + (row.messagesSent ?? 0), 0),
    })),
    emotes: dates.map(date => ({
      date,
      value: (byDate.get(date) ?? []).reduce((sum, row) => sum + (row.emotesPlayed ?? 0), 0),
    })),
  };
}

export function dailyMeanDelta(
  scenes: SceneStats[],
  asOf: string,
  days: RangeDays,
  pick: (row: SceneDailyStats) => number | null,
): number | null {
  const start = addDays(asOf, -(days - 1));
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(days - 1));

  const windowMean = (from: string, to: string): number | null => {
    const values = scenes
      .flatMap(scene => dailyInRange(scene, from, to).map(pick))
      .filter((value): value is number => value !== null);
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  const current = windowMean(start, asOf);
  const previous = windowMean(prevStart, prevEnd);
  if (current === null || previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
