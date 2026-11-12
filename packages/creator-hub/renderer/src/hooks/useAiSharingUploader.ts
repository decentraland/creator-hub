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
  const consented = useSelector(state => hasSharingConsent(selectSharingConsent(state)));
  const active = featureOn && consented && isSignedIn;

  // Another account has its own consent on the server; confirm it before uploading for it.
  useEffect(() => {
    dispatch(aiSharingActions.setServerConsentSynced(false));
  }, [wallet, dispatch]);

  useEffect(() => {
    if (!active) return;
    void dispatch(aiSharingActions.flush());
    const timer = setInterval(() => void dispatch(aiSharingActions.flush()), UPLOAD_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active, wallet, dispatch]);
}

export function AiSharingUploader() {
  useAiSharingUploader();
  return null;
}
