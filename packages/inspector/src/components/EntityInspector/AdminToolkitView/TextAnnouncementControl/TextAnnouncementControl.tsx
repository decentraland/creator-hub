import React from 'react';
import type { Entity } from '@dcl/ecs';
import { withSdk } from '../../../../hoc/withSdk';
import { CheckboxGroup, CheckboxField } from '../../../ui';
import { useAdminTools } from '../useAdminTools';
import './TextAnnouncementControl.css';

type Props = {
  entity: Entity;
};

const TextAnnouncementControl = withSdk<Props>(({ sdk, entity }) => {
  const [adminComponent, updateControl] = useAdminTools(entity, sdk.components.AdminTools);

  if (!adminComponent) return null;

  return (
    <div className="TextAnnouncementControl">
      <CheckboxGroup>
        <CheckboxField
          label="Show author on each announcements"
          checked={adminComponent.textAnnouncementControl.showAuthorOnEachAnnouncement || false}
          onChange={e =>
            updateControl('textAnnouncementControl', {
              showAuthorOnEachAnnouncement: e.target.checked,
            })
          }
        />
      </CheckboxGroup>
    </div>
  );
});

export default React.memo(TextAnnouncementControl);
