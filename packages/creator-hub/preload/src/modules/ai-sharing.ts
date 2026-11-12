import type { AiSharingQueuedItem, AiTurnRecord } from '/shared/types/ai-sharing';

import { invoke } from '../services/ipc';

export async function peek(address: string, limit: number): Promise<AiTurnRecord[]> {
  return invoke('aiSharing.peek', address, limit);
}

export async function ack(recordIds: string[]): Promise<void> {
  return invoke('aiSharing.ack', recordIds);
}

export async function list(): Promise<AiSharingQueuedItem[]> {
  return invoke('aiSharing.list');
}

export async function purge(): Promise<void> {
  return invoke('aiSharing.purge');
}
