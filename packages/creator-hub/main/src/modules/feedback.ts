import fs from 'node:fs/promises';
import os from 'node:os';
import { captureFeedback, getClient } from '@sentry/electron/main';
import log from 'electron-log/main';

import {
  FEEDBACK_MESSAGE_MAX_LENGTH,
  type FeedbackDelivery,
  type FeedbackReport,
} from '/shared/types/feedback';

const LOG_TAIL_BYTES = 1024 * 1024;
const DELIVERY_TIMEOUT_MS = 30_000;
const CONTACT_MAX_LENGTH = 254;
const USER_FOLDER =
  /(?:(?<!\w)[a-z]:|(?<![\w.~\\/-]))[\\/]+(?:users|home)[\\/]+[^\\/\r\n"'<>:|?*]+/gi;

async function readLogTail(path: string) {
  const file = await fs.open(path, 'r');
  try {
    const { size } = await file.stat();
    const length = Math.min(size, LOG_TAIL_BYTES);
    const { buffer } = await file.read(Buffer.alloc(length), 0, length, size - length);
    return buffer.toString('utf8');
  } finally {
    await file.close();
  }
}

function redactHome(text: string) {
  return text.replaceAll(os.homedir(), '~').replace(USER_FOLDER, '~');
}

function assertValidReport({ message, contact }: FeedbackReport) {
  const validMessage =
    typeof message === 'string' &&
    message.length > 0 &&
    message.length <= FEEDBACK_MESSAGE_MAX_LENGTH;
  const validContact =
    !contact ||
    ((contact.method === 'discord' || contact.method === 'email') &&
      typeof contact.value === 'string' &&
      contact.value.length <= CONTACT_MAX_LENGTH);
  if (!validMessage || !validContact) throw new Error('Invalid feedback report');
}

function captureAndAwaitDelivery(capture: () => string): Promise<FeedbackDelivery> {
  const client = getClient();
  if (!client) return Promise.reject(new Error('Sentry is not initialized'));
  return new Promise((resolve, reject) => {
    let eventId: string | undefined;
    const stop = client.on('afterSendEvent', (event, { statusCode }) => {
      if (event.event_id !== eventId) return;
      if (statusCode === undefined) settle(() => resolve('queued'));
      else if (statusCode >= 200 && statusCode < 300) settle(() => resolve('sent'));
      else settle(() => reject(new Error(`Sentry responded with status ${statusCode}`)));
    });
    const timeout = setTimeout(() => settle(() => resolve('queued')), DELIVERY_TIMEOUT_MS);
    function settle(outcome: () => void) {
      clearTimeout(timeout);
      stop();
      outcome();
    }
    try {
      eventId = capture();
    } catch (error) {
      settle(() => reject(error));
    }
  });
}

/**
 * Sends a user report to Sentry User Feedback, with the app log's tail when asked.
 * @returns `sent` when Sentry answers 2xx; `queued` when the transport stores it or 30 s pass.
 * @throws when the report is malformed, capture fails or Sentry answers with an error status.
 */
export async function send(report: FeedbackReport): Promise<FeedbackDelivery> {
  assertValidReport(report);
  const { message, contact, includeLogs, associatedEventId, source } = report;
  if (!import.meta.env.PROD) {
    log.info('[Feedback] dev build, not sent', { message, includeLogs, associatedEventId, source });
    return 'sent';
  }
  const attachments = includeLogs
    ? [
        {
          filename: 'main.log',
          data: redactHome(await readLogTail(log.transports.file.getFile().path)),
        },
      ]
    : undefined;
  const email = contact?.method === 'email' ? contact.value : undefined;
  const tags = {
    source,
    ...(contact && { contact_method: contact.method }),
    ...(contact?.method === 'discord' && { discord: contact.value }),
  };
  return captureAndAwaitDelivery(() =>
    captureFeedback({ message, email, associatedEventId, tags }, { attachments }),
  );
}
