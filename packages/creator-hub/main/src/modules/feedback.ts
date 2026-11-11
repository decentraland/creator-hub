import fs from 'node:fs/promises';
import os from 'node:os';
import { captureFeedback } from '@sentry/electron/main';
import log from 'electron-log/main';

import type { FeedbackReport } from '/shared/types/feedback';

const LOG_TAIL_BYTES = 1024 * 1024;

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
  const home = os.homedir();
  return text.replaceAll(home, '~').replaceAll(home.replaceAll('\\', '/'), '~');
}

/** Sends a user report to Sentry User Feedback, with the app log's tail when asked. Resolves to whether it was queued. */
export async function send({
  message,
  email,
  includeLogs,
  associatedEventId,
  source,
}: FeedbackReport) {
  if (!import.meta.env.PROD) {
    log.info('[Feedback] dev build, not sent', { message, includeLogs, associatedEventId, source });
    return false;
  }
  const attachments = includeLogs
    ? [
        {
          filename: 'main.log',
          data: redactHome(await readLogTail(log.transports.file.getFile().path)),
        },
      ]
    : undefined;
  captureFeedback({ message, email, associatedEventId, tags: { source } }, { attachments });
  return true;
}
