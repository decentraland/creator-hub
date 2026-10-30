import { isAddress, type Address } from 'viem';

import { resolveNameOwner, toDCLNameLabel } from '/@/modules/store/ens/names';
import type { TranslationPath } from '/@/modules/store/translation/types';

export type RecipientPurpose = 'transfer' | 'add';
export type Recipient = { address: Address; name?: string };
export type Resolution =
  | { kind: 'empty' }
  | { kind: 'error'; error: TranslationPath }
  | { kind: 'resolved'; recipient: Recipient };

const SELF_ERROR: Record<RecipientPurpose, TranslationPath> = {
  transfer: 'recipient.errors.self_transfer',
  add: 'recipient.errors.self_add',
};

/** Reads a typed recipient as a wallet address or a Decentraland NAME and resolves its owner. */
export async function resolveRecipient(
  value: string,
  self: string,
  purpose: RecipientPurpose,
): Promise<Resolution> {
  const input = value.trim();
  if (!input) return { kind: 'empty' };

  const isSelf = (address: string) => address.toLowerCase() === self.toLowerCase();
  if (input.toLowerCase().startsWith('0x')) {
    if (!isAddress(input, { strict: false })) {
      return { kind: 'error', error: 'recipient.errors.invalid' };
    }
    if (isSelf(input)) return { kind: 'error', error: SELF_ERROR[purpose] };
    return { kind: 'resolved', recipient: { address: input.toLowerCase() as Address } };
  }

  const label = toDCLNameLabel(input);
  if (!label) return { kind: 'error', error: 'recipient.errors.invalid' };
  const owner = await resolveNameOwner(label);
  if (!owner) return { kind: 'error', error: 'recipient.errors.not_found' };
  if (isSelf(owner)) return { kind: 'error', error: SELF_ERROR[purpose] };
  return { kind: 'resolved', recipient: { address: owner, name: label } };
}
