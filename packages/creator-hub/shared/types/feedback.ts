export type FeedbackSource = 'publish-failure' | 'logo-menu';

export type FeedbackReport = {
  message: string;
  email?: string;
  includeLogs: boolean;
  associatedEventId?: string;
  source: FeedbackSource;
};
