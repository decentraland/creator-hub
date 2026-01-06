import { PublishProject } from '../../Modals/PublishProject';
import { PublishHistory } from '../../Modals/PublishHistory';
import { InstallClient } from '../../Modals/InstallClient';
import { WarningModal } from '../../Modals/WarningModal';

import type { Props } from './types';

export function DeployModal({ type, initialStep, ...props }: Props) {
  switch (type) {
    case 'publish':
      return (
        <PublishProject
          open={type === 'publish'}
          initialStep={initialStep}
          {...props}
        />
      );
    case 'publish-history':
      return (
        <PublishHistory
          open={type === 'publish-history'}
          {...props}
        />
      );
    case 'install-client':
      return (
        <InstallClient
          open={type === 'install-client'}
          onClose={() => props.onClose(false)}
        />
      );
    case 'warning':
      return (
        <WarningModal
          open={type === 'warning'}
          onClose={props.onClose}
        />
      );
    default:
      return null;
  }
}
