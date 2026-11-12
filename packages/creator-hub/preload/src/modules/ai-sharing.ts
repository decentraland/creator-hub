import type { AiSharingQueuedItem, AiTurnRecord } from '/shared/types/ai-sharing';

import { invoke } from '../services/ipc';

export async function peek(address: string, limit: number): Promise<AiTurnRecord[]> {
  return invoke('aiSharing.peek', address, limit);
}

export async function ack(recordIds: string[]): Promise<void> {
  return invoke('aiSharing.ack', recordIds);
}

export async function list(address: string): Promise<AiSharingQueuedItem[]> {
  return invoke('aiSharing.list', address);
}

export async function purge(address: string): Promise<void> {
  return invoke('aiSharing.purge', address);
}

export async function setConversationShared(
  conversationId: string,
  shared: boolean,
): Promise<void> {
  return invoke('aiSharing.setConversationShared', conversationId, shared);
}

export async function setWallet(address: string | null): Promise<void> {
  return invoke('aiSharing.setWallet', address);
}
