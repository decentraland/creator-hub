import { useEffect } from 'react';

import { hasSharingConsent } from '/shared/types/ai-sharing';

import { useDispatch, useSelector } from '#store';
import {
  actions as aiSharingActions,
  isSharingFeatureOn,
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
  const { isSignedIn, wallet } = useAuth();
  const featureOn = useSelector(isSharingFeatureOn);
  const consent = useSelector(selectSharingConsent);
  // A "no" still syncs once, so a withdrawal that failed to reach the server gets there; the
  // timer only keeps running while there is something to upload.
  const consented = hasSharingConsent(consent);
  const decided = consent !== undefined;

  // Another account has its own consent on the server; confirm it before uploading for it.
  useEffect(() => {
    dispatch(aiSharingActions.setServerConsentSynced(false));
  }, [wallet, dispatch]);

  useEffect(() => {
    if (!featureOn || !isSignedIn || !decided) return;
    void dispatch(aiSharingActions.flush());
    if (!consented) return;
    const timer = setInterval(() => void dispatch(aiSharingActions.flush()), UPLOAD_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [featureOn, isSignedIn, decided, consented, wallet, dispatch]);
}

export function AiSharingUploader() {
  useAiSharingUploader();
  return null;
}
