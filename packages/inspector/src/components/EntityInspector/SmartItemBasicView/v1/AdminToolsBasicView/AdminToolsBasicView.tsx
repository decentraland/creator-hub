import React, { useMemo } from 'react';

import { withSdk } from '../../../../../hoc/withSdk';

import { Accordion } from '../../../../ui';

import { VideoControl } from '../../../AdminToolkitView/VideoControl';
import { SmartItemControl } from '../../../AdminToolkitView/SmartItemControl';
import { TextAnnouncementControl } from '../../../AdminToolkitView/TextAnnouncementControl';

import { type Props } from '../../../AdminToolkitView/types';
import { type AdminControlKey, useAdminTools } from '../../../AdminToolkitView/useAdminTools';

import './AdminToolsBasicView.css';

const AdminToolsBasicView = withSdk<Props>(({ sdk, entity }) => {
  const { AdminTools, Config } = sdk.components;
  const [adminComponent, updateControl] = useAdminTools(entity, AdminTools);

  const handleToggleEnabled = (control: AdminControlKey, isEnabled: boolean) =>
    updateControl(control, { isEnabled });

  const config = useMemo(() => {
    return Config.getOrNull(entity);
  }, [entity]);

  if (!config || !adminComponent) return null;

  return (
    <div className="AdminToolsBasicViewInspector">
      <Accordion
        label="TEXT ANNOUNCEMENTS"
        className="PanelSection border"
        enabled={!!adminComponent.textAnnouncementControl?.isEnabled}
        onToggleEnabled={enabled => handleToggleEnabled('textAnnouncementControl', enabled)}
      >
        <TextAnnouncementControl entity={entity} />
      </Accordion>
      <Accordion
        label="VIDEO SCREENS"
        className="PanelSection border"
        enabled={!!adminComponent.videoControl?.isEnabled}
        onToggleEnabled={enabled => handleToggleEnabled('videoControl', enabled)}
      >
        <VideoControl entity={entity} />
      </Accordion>
      <Accordion
        label="SMART ITEM ACTIONS"
        className="PanelSection border"
        enabled={!!adminComponent.smartItemsControl?.isEnabled}
        onToggleEnabled={enabled => handleToggleEnabled('smartItemsControl', enabled)}
      >
        <SmartItemControl entity={entity} />
      </Accordion>
    </div>
  );
});

export default React.memo(AdminToolsBasicView);
