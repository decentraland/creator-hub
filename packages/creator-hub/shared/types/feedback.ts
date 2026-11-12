export const FEEDBACK_MESSAGE_MAX_LENGTH = 4096;

export type FeedbackSource = 'publish-failure' | 'logo-menu';

export type FeedbackDelivery = 'sent' | 'queued' | 'unknown';

export type ContactMethod = 'discord' | 'email';

export type FeedbackContact = { method: ContactMethod; value: string };

export type FeedbackReport = {
  message: string;
  contact?: FeedbackContact;
  includeLogs: boolean;
  associatedEventId?: string;
  source: FeedbackSource;
};
