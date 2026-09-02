import React, { useCallback, useState } from 'react';

import { getSceneClient } from '../../../lib/rpc/scene';
import { useAppDispatch } from '../../../redux/hooks';
import { togglePanel } from '../../../redux/ui';
import { PanelName } from '../../../redux/ui/types';

import './SdkUpgradeNotice.css';

export const MIN_SDK_VERSION = '7.26.0';

/** Full-cover UI Editor gate: update `@dcl/sdk` through the host, then reload the scene. */
const SdkUpgradeNoticeComponent: React.FC = () => {
  const dispatch = useAppDispatch();
  const [updating, setUpdating] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleUpdate = useCallback(async () => {
    const client = getSceneClient();
    if (!client) return;
    setUpdating(true);
    setFailed(false);
    try {
      const { ok } = await client.updateSdk();
      if (ok) {
        window.location.reload();
        return;
      }
      setFailed(true);
    } catch {
      setFailed(true);
    }
    setUpdating(false);
  }, []);

  const handleMaybeLater = useCallback(() => {
    dispatch(togglePanel({ panel: PanelName.UI_DESIGNER, enabled: false }));
    void getSceneClient()?.setUiDesignerMode(false).catch(console.error);
  }, [dispatch]);

  return (
    <div className="ui-designer-sdk-notice">
      <div className="ui-designer-sdk-notice-card">
        <div className="ui-designer-sdk-notice-body">
          <h2 className="ui-designer-sdk-notice-title">UI Editor Unavailable</h2>
          <p className="ui-designer-sdk-notice-description">
            Update your SDK to <strong>version {MIN_SDK_VERSION}</strong> or later to use the UI
            Editor.
          </p>
          {failed && (
            <p className="ui-designer-sdk-notice-error">
              Couldn’t update the SDK automatically. Update <strong>@dcl/sdk</strong> in your scene
              and try again.
            </p>
          )}
          <div className="ui-designer-sdk-notice-actions">
            <button
              type="button"
              className="ui-designer-sdk-notice-btn primary"
              onClick={handleUpdate}
              disabled={updating}
            >
              {updating ? 'Updating…' : 'Update SDK'}
            </button>
            <button
              type="button"
              className="ui-designer-sdk-notice-btn"
              onClick={handleMaybeLater}
              disabled={updating}
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SdkUpgradeNotice = React.memo(SdkUpgradeNoticeComponent);
export default SdkUpgradeNotice;
