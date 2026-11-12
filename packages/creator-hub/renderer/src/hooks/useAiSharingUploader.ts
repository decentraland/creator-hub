import { useEffect } from 'react';

import { hasSharingConsent } from '/shared/types/ai-sharing';

import { aiSharing } from '#preload';
import { useDispatch, useSelector } from '#store';
import {
  actions as aiSharingActions,
  canManageSharing,
  selectSharingConsent,
} from '/@/modules/store/aiSharing';
import { useAuth } from './useAuth';

const UPLOAD_INTERVAL_MS = 60_000;

/**
 * Uploads the turns main queued while the creator shares conversations: once at start, then
 * every minute (the slice backs off on failures). Mounted once, app-wide, inside AuthProvider,
 * since the signing identity lives there.
 */
export function useAiSharingUploader() {
  const dispatch = useDispatch();
  const { wallet } = useAuth();
  const address = wallet?.toLowerCase() ?? null;
  const configured = useSelector(state => canManageSharing(state, address));
  const consent = useSelector(state => selectSharingConsent(state, address));
  const consented = hasSharingConsent(consent);
  const decided = consent !== undefined;
  // The timer runs while there is something to upload, and while a decision (a "no" included)
  // hasn't reached the service yet: a withdrawal that failed is retried, with the usual backoff,
  // instead of waiting for the next launch.
  const keepRunning = consented || consent?.delivered !== true;

  // Main records turns only for the wallet signed in here; tell it on every change.
  useEffect(() => {
    void aiSharing.setWallet(address);
  }, [address]);

  useEffect(() => {
    if (!configured || address === null || !decided) return;
    void dispatch(aiSharingActions.flush());
    if (!keepRunning) return;
    const timer = setInterval(() => void dispatch(aiSharingActions.flush()), UPLOAD_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [configured, address, decided, keepRunning, dispatch]);
}

export function AiSharingUploader() {
  useAiSharingUploader();
  return null;
}
