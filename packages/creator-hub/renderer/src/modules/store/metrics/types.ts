import type { SceneStats } from '/shared/types/metrics';

export type MetricsState = {
  address: string | null;
  asOf: string | null;
  scenes: SceneStats[];
};

export type RangeDays = 7 | 30 | 90;

export type DailyPoint = {
  date: string;
  value: number | null;
};

export type ChartSeries = {
  key: string;
  label: string;
  color: string;
  points: DailyPoint[];
};

export type RetentionKey = 'd1' | 'd7' | 'd30';

export type CsvRow = {
  date: string;
  visits: number;
  uniqueUsers: number;
  newUsers: number;
  medianActiveTimeS: number;
  peakConcurrentUsers: number;
  messagesSent: number;
  emotesPlayed: number;
};
