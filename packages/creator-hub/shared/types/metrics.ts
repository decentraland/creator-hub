export type SceneType = 'genesis' | 'world';

export type SceneMetricsWindow = {
  users: number | null;
  newUsers: number | null;
  returningUsers: number | null;
  visits: number | null;
  medianActiveTimeS: number | null;
  totalActiveHours: number | null;
  afkTimePct: number | null;
  peakConcurrentUsers: number | null;
  medianFps: number | null;
  perfSessions: number | null;
  dau: number | null;
  desktopUsers: number | null;
  mobileUsers: number | null;
  messagesSent: number | null;
  emotesPlayed: number | null;
  avgSessionActiveTimeS: number | null;
};

export type SceneRetention = {
  cohort: number | null;
  d1: number | null;
  d7: number | null;
  d30: number | null;
};

export type SceneRetentionPoint = {
  date: string;
  cohort: number;
  d1: number | null;
  d7: number | null;
  d30: number | null;
};

export type SceneDailyStats = {
  date: string;
  visits: number | null;
  uniqueUsers: number | null;
  newUsers: number | null;
  medianActiveTimeS: number | null;
  peakConcurrentUsers: number | null;
  messagesSent: number | null;
  emotesPlayed: number | null;
};

export type SceneStats = {
  sceneType: SceneType;
  sceneId: string;
  title: string | null;
  deployerAddress: string | null;
  windows: {
    yesterday: SceneMetricsWindow;
    last_7d: SceneMetricsWindow;
    last_30d: SceneMetricsWindow;
  };
  retention: SceneRetention;
  retentionSeries: SceneRetentionPoint[];
  daily: SceneDailyStats[];
  deployDates: string[];
};

export type CreatorScenesStats = {
  address: string;
  asOf: string;
  scenes: SceneStats[];
};
