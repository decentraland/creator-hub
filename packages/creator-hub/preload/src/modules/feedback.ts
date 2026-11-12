import type { FeedbackReport } from '/shared/types/feedback';
import { invoke } from '../services/ipc';

export async function send(report: FeedbackReport) {
  return invoke('feedback.send', report);
}
