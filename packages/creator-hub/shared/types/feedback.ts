export type FeedbackSource = 'publish-failure' | 'logo-menu';

export type FeedbackDelivery = 'sent' | 'queued';

export type ContactMethod = 'discord' | 'email';

export type FeedbackContact = { method: ContactMethod; value: string };

export type FeedbackReport = {
  message: string;
  contact?: FeedbackContact;
  includeLogs: boolean;
  associatedEventId?: string;
  source: FeedbackSource;
};
