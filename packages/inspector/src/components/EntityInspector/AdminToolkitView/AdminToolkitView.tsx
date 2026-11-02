import React from 'react';
import { withSdk } from '../../../hoc/withSdk';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';

import { Accordion, InfoTooltip } from '../../ui';
import { Container } from '../../Container';

import { VideoControl } from './VideoControl';
import { SmartItemControl } from './SmartItemControl';
import { TextAnnouncementControl } from './TextAnnouncementControl';
import { type Props } from './types';
import { type AdminControlKey, useAdminTools } from './useAdminTools';
import './AdminToolkitView.css';

const AdminToolkitView = withSdk<Props>(({ sdk, entity, initialOpen = true }) => {
  const { AdminTools } = sdk.components;
  const [adminComponent, updateControl] = useAdminTools(entity, AdminTools);
  const hasAdmintoolkit = useHasComponent(entity, AdminTools);

  const handleToggleEnabled = (control: AdminControlKey, isEnabled: boolean) =>
    updateControl(control, { isEnabled });

  if (!hasAdmintoolkit) return null;

  return (
    <Container
      label="Admin Tools"
      className="AdminToolkitViewInspector"
      initialOpen={initialOpen}
      rightContent={
        <InfoTooltip
          text="Admin Tools enables a whole set of in-world actions for special admin users."
          link="https://docs.decentraland.org/creator/scene-editor/operate-live/scene-admin"
          type="help"
        />
      }
    >
      <Accordion
        label="VIDEO SCREENS"
        className="PanelSection"
        enabled={!!adminComponent.videoControl.isEnabled}
        onToggleEnabled={enabled => handleToggleEnabled('videoControl', enabled)}
      >
        <VideoControl entity={entity} />
      </Accordion>

      <Accordion
        label="TEXT ANNOUNCEMENTS"
        className="PanelSection"
        enabled={!!adminComponent.textAnnouncementControl.isEnabled}
        onToggleEnabled={enabled => handleToggleEnabled('textAnnouncementControl', enabled)}
      >
        <TextAnnouncementControl entity={entity} />
      </Accordion>

      <Accordion
        label="SMART ITEM ACTIONS"
        className="PanelSection"
        enabled={!!adminComponent.smartItemsControl.isEnabled}
        onToggleEnabled={enabled => handleToggleEnabled('smartItemsControl', enabled)}
      >
        <SmartItemControl entity={entity} />
      </Accordion>
    </Container>
  );
});

export default React.memo(AdminToolkitView);
